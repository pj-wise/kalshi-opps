// Generic probability model.
//
// Design principle: when we have no real external signal, we must NOT
// fabricate confidence.  The generic model only produces an estimate when it
// can combine:
//   (a) a reasonable market-implied anchor (bid/ask or last price), and
//   (b) at least one of {category base-rate, volume liquidity signal}.
//
// Even then it caps confidence at ~0.3 to keep opportunity scores modest
// until better models supersede it.

import type { KalshiMarket } from "@/lib/kalshi/types";
import { centsToProbability, clamp01, midImpliedProbability } from "@/lib/math/probability";
import { insufficient, type ModelEstimate, type ModelInput, type ProbabilityModel } from "./types";

// Rough base-rates by category/keyword, in 0-1.  These are not calibrated;
// they're a soft Bayesian prior that nudges the market in a direction we
// can defend.  Keeping them explicit so they're auditable.
const CATEGORY_PRIORS: Array<{ match: RegExp; prior: number; note: string }> = [
  { match: /unemployment|CPI|GDP|rate\s*cut|FOMC|BLS|BEA/i, prior: 0.45, note: "economic release base rate" },
  { match: /championship|World Series|Super Bowl|AFC|NFC/i, prior: 0.1, note: "championship narrow-outcome prior" },
  { match: /hurricane|storm|named/i, prior: 0.3, note: "seasonal weather prior" },
  { match: /\bBTC\b|bitcoin|ETH\b|ethereum/i, prior: 0.5, note: "crypto level-cross prior" },
  { match: /S&P|SPX|Nasdaq|Dow/i, prior: 0.5, note: "equity level-cross prior" },
];

export const GENERIC_MODEL_VERSION = "generic-v0.2.0";

export const genericModel: ProbabilityModel = {
  id: "generic",
  name: "Generic (market + base-rate blend)",
  version: GENERIC_MODEL_VERSION,

  supportsMarket(market: KalshiMarket): boolean {
    return market.status === "active" || market.status === "unopened";
  },

  async estimate(market: KalshiMarket): Promise<ModelEstimate> {
    const now = new Date();
    const marketProb = midImpliedProbability(
      market.yesBidCents,
      market.yesAskCents,
      market.lastPriceCents,
    );
    if (marketProb == null) {
      return insufficient(GENERIC_MODEL_VERSION, "no bid/ask or last price available");
    }

    const prior = findPrior(market);
    const liquidityScore = Math.min(1, market.liquidityCents / 50_000);
    const volume24h = market.volume24h;

    // On illiquid or quiet markets we trust the market mid less — a quoted
    // price nobody has traded is weak evidence. On liquid, actively-traded
    // markets we lean heavily on the market mid (it incorporates real money).
    //
    //   liquid + active:   marketWeight ≈ 0.90, priorWeight ≈ 0.10
    //   quiet or illiquid: marketWeight ≈ 0.50, priorWeight ≈ 0.50
    const liquidityPenalty = liquidityScore < 0.2 ? 0.2 : 0;
    const quietPenalty = volume24h < 20 ? 0.2 : 0;
    const marketWeight = Math.max(
      0.5,
      0.7 + 0.2 * liquidityScore - liquidityPenalty - quietPenalty,
    );
    const priorWeight = prior ? Math.max(0.1, 1 - marketWeight) : 0;
    const totalWeight = marketWeight + priorWeight;

    const blended = prior
      ? (marketProb * marketWeight + prior.prior * priorWeight) / totalWeight
      : marketProb;

    const probability = clamp01(blended);

    // Confidence: generic model stays modest, but we allow a bit more when
    // we have a matching prior AND the market has real trading activity.
    //   base:              0.10
    //   + liquidity bonus: up to 0.20
    //   + volume bonus:    up to 0.10 if volume24h > 100
    //   + prior bonus:     0.10 when we matched a category prior
    //   cap:               0.50 (was 0.30)
    const volumeBonus = Math.min(0.1, Math.log10(Math.max(1, volume24h)) * 0.03);
    const confidence = clamp01(
      0.1 + 0.2 * liquidityScore + volumeBonus + (prior ? 0.1 : 0),
    );

    const inputs: ModelInput[] = [
      {
        source: "kalshi",
        key: "market_implied",
        value: { probability: marketProb, yesBidCents: market.yesBidCents, yesAskCents: market.yesAskCents },
        weight: marketWeight / totalWeight || 1,
        contribution: marketProb * (marketWeight / (totalWeight || 1)),
        timestamp: now,
        freshnessSec: 0,
      },
    ];
    if (prior) {
      inputs.push({
        source: "base_rate",
        key: prior.note,
        value: { prior: prior.prior, matched: prior.match.source },
        weight: priorWeight / totalWeight,
        contribution: prior.prior * (priorWeight / totalWeight),
        timestamp: now,
        freshnessSec: null,
      });
    }
    inputs.push({
      source: "kalshi",
      key: "liquidity_signal",
      value: { liquidityCents: market.liquidityCents, score: liquidityScore },
      weight: 0,
      contribution: null,
      timestamp: now,
      freshnessSec: 0,
      metadata: { role: "confidence_only" },
    });

    const explanation = prior
      ? `Weighted blend of market mid-price (${(marketProb * 100).toFixed(0)}%) and a "${prior.note}" prior (${(prior.prior * 100).toFixed(0)}%). ` +
        `Weights ${(marketWeight / totalWeight).toFixed(2)}/${(priorWeight / totalWeight).toFixed(2)}.`
      : `No category prior matched; estimate anchors to market mid-price (${(marketProb * 100).toFixed(0)}%).`;

    return {
      status: "ok",
      probability,
      confidence,
      explanation,
      inputs,
      modelVersion: GENERIC_MODEL_VERSION,
    };
  },
};

function findPrior(market: KalshiMarket): { prior: number; note: string; match: RegExp } | null {
  const haystack = `${market.title} ${market.subtitle ?? ""} ${market.category ?? ""} ${market.rulesPrimary ?? ""}`;
  for (const row of CATEGORY_PRIORS) {
    if (row.match.test(haystack)) return row;
  }
  return null;
}

// Centralized price-based market-implied probability helper, exported for callers
// that only need to know the raw market anchor (scanner, snapshot, etc).
export { centsToProbability, midImpliedProbability };
