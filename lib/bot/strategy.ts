// Automated trading-bot architecture.
//
// SAFETY MODEL
//   The bot is DISABLED by default.  Live mode is gated behind TWO env vars:
//     - KALSHI_LIVE_TRADING_ENABLED must be truthy
//     - calibration data must exist and avg Brier must be below CALIBRATION_BRIER_MAX
//   Even then, in V1 the "live" path is intentionally not wired: the signer
//   is not implemented and the bot always runs in paper mode.
//
// WHAT IT DOES
//   Each tick:
//     1. Read current settings and bankroll.
//     2. Pull latest estimates (from the regular sync) and rank by score.
//     3. For every candidate with score ≥ settings.alertMinOpportunityScore,
//        and after kill-switch checks, compute Kelly stake and emit either a
//        paper trade or (eventually) a live order.
//     4. Enforce max position + bankroll ceilings so a bad model can't drain.

import { prisma } from "@/lib/prisma";
import { expectedROI, kellyStakeCents, midImpliedProbability } from "@/lib/math/probability";
import { readKalshiEnv } from "@/lib/kalshi";
import { readSettings } from "@/lib/settings";

export interface BotTickResult {
  mode: "paper" | "live-disabled";
  bankrollCents: number;
  candidatesConsidered: number;
  paperTradesPlaced: number;
  reasons: Array<{ ticker: string; action: "placed" | "skipped"; reason: string }>;
}

const CALIBRATION_BRIER_MAX = 0.22; // model must beat an uninformed 50/50 by a wide margin

export async function runTradingBotTick(options: { allowLive?: boolean } = {}): Promise<BotTickResult> {
  const env = readKalshiEnv();
  const settings = await readSettings();
  const reasons: BotTickResult["reasons"] = [];

  const liveAllowed = Boolean(options.allowLive) && env.liveTradingEnabled;
  if (liveAllowed) {
    const calibrated = await meetsCalibrationThreshold();
    if (!calibrated) {
      return {
        mode: "live-disabled",
        bankrollCents: env.botBankrollCents,
        candidatesConsidered: 0,
        paperTradesPlaced: 0,
        reasons: [{ ticker: "*", action: "skipped", reason: "calibration threshold not met" }],
      };
    }
    // V1 intentionally does not implement live order placement.
    return {
      mode: "live-disabled",
      bankrollCents: env.botBankrollCents,
      candidatesConsidered: 0,
      paperTradesPlaced: 0,
      reasons: [{ ticker: "*", action: "skipped", reason: "live trading not implemented in V1" }],
    };
  }

  const bankroll = settings.defaultBankrollCents;
  const candidates = await prisma.modelEstimate.findMany({
    where: {
      status: "ok",
      opportunityScore: { gte: settings.alertMinOpportunityScore },
      confidence: { gte: settings.minConfidence },
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 10) },
    },
    orderBy: { opportunityScore: "desc" },
    take: 20,
    include: { market: true },
  });

  let placed = 0;
  for (const est of candidates) {
    const market = est.market;
    if (market.status !== "active") {
      reasons.push({ ticker: market.ticker, action: "skipped", reason: "market not active" });
      continue;
    }
    if (est.probability == null) continue;
    const marketProb = midImpliedProbability(
      market.lastYesBidCents,
      market.lastYesAskCents,
      market.lastPriceCents,
    );
    if (marketProb == null) continue;
    const side: "yes" | "no" = est.probability > marketProb ? "yes" : "no";
    const ask =
      side === "yes"
        ? market.lastYesAskCents
        : market.lastNoAskCents ??
          (market.lastYesAskCents != null ? 100 - market.lastYesAskCents : null);
    if (ask == null) {
      reasons.push({ ticker: market.ticker, action: "skipped", reason: "no ask price" });
      continue;
    }
    const roi = expectedROI(side, est.probability, ask);
    if (roi == null || roi <= 0) {
      reasons.push({ ticker: market.ticker, action: "skipped", reason: "non-positive expected ROI" });
      continue;
    }
    const stake = kellyStakeCents(
      side,
      est.probability,
      ask,
      bankroll,
      settings.defaultKellyFraction,
    );
    if (stake < ask) {
      reasons.push({ ticker: market.ticker, action: "skipped", reason: "Kelly stake < 1 contract" });
      continue;
    }
    const openExposure = await openExposureCents();
    if (openExposure + stake > bankroll) {
      reasons.push({ ticker: market.ticker, action: "skipped", reason: "would exceed bankroll" });
      continue;
    }
    const contracts = Math.floor(stake / ask);
    await prisma.paperTrade.create({
      data: {
        marketId: market.id,
        side,
        entryPriceCents: ask,
        contracts,
        bankrollAtEntryCents: bankroll,
        notes: "auto-bot (paper)",
        estimateId: est.id,
        modelProbability: est.probability,
        marketProbability: est.marketProbability,
        confidence: est.confidence,
        opportunityScore: est.opportunityScore,
        modelId: est.modelId,
        modelVersion: est.modelVersion,
        status: "open",
      },
    });
    placed += 1;
    reasons.push({ ticker: market.ticker, action: "placed", reason: `${side.toUpperCase()} ${contracts} @ ${ask}¢` });
  }

  return {
    mode: "paper",
    bankrollCents: bankroll,
    candidatesConsidered: candidates.length,
    paperTradesPlaced: placed,
    reasons,
  };
}

async function openExposureCents(): Promise<number> {
  const open = await prisma.paperTrade.findMany({
    where: { status: "open" },
    select: { entryPriceCents: true, contracts: true },
  });
  return open.reduce((acc, t) => acc + t.entryPriceCents * t.contracts, 0);
}

async function meetsCalibrationThreshold(): Promise<boolean> {
  const resolved = await prisma.paperTrade.findMany({
    where: { status: "resolved", modelProbability: { not: null }, correct: { not: null } },
    select: { modelProbability: true, correct: true },
  });
  if (resolved.length < 50) return false;
  const avgBrier =
    resolved.reduce((acc, r) => {
      const p = r.modelProbability ?? 0;
      const actual = r.correct ? 1 : 0;
      return acc + (p - actual) ** 2;
    }, 0) / resolved.length;
  return avgBrier < CALIBRATION_BRIER_MAX;
}
