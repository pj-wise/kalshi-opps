// Opportunity-score calculation + structural tags.
//
// Previous version used a pure product of eight sub-multipliers, each in [0,1].
// That design meant one weak factor zeroed everything, and the generic model
// (which caps its own confidence at 0.3) had a structural score ceiling of
// ~5/100 — making the default 50-threshold unreachable.
//
// New version uses a *weighted sum* of two axes:
//
//   score = 0.6 * probDiffAxis + 0.4 * structuralAxis
//
// probDiffAxis — scaled 0..100 based on the model vs market gap, confidence,
//                and historical calibration. This is the "we think the market
//                is wrong" axis.
// structuralAxis — scaled 0..100 based on market-structure signals that are
//                  worth looking at even when the model doesn't disagree:
//                  decent liquidity, tight-enough spread, time left before
//                  close, and freshness of data.
//
// Markets with no model estimate still get a structuralAxis score and can
// surface as "possibly interesting" based on tags.

import { clamp01 } from "./probability";
import type { KalshiMarket } from "@/lib/kalshi/types";

export interface OpportunityScoreInputs {
  modelProbability: number | null;
  marketProbability: number | null;
  confidence: number | null;
  liquidityCents: number | null;
  spreadCents: number | null;
  secondsToClose: number | null;
  dataAgeSec: number | null;
  calibrationScore?: number;
}

export interface OpportunityScoreWeights {
  minProbDiff: number;
  liquiditySaturationCents: number;
  spreadPenaltyCents: number;
  idealSecondsToClose: number;
  freshnessDecaySec: number;
  confidenceFloor: number;
}

export const DEFAULT_WEIGHTS: OpportunityScoreWeights = {
  minProbDiff: 0.02,
  liquiditySaturationCents: 50_000,
  spreadPenaltyCents: 8,
  idealSecondsToClose: 60 * 60 * 24 * 3,
  freshnessDecaySec: 60 * 60,
  confidenceFloor: 0.1,
};

export interface OpportunityScoreBreakdown {
  score: number;
  probDiffAxis: number;
  structuralAxis: number;
  components: {
    probDiff: number;
    confidenceMultiplier: number;
    liquidityScore: number;
    spreadScore: number;
    timeScore: number;
    freshnessScore: number;
    calibrationMultiplier: number;
  };
  insufficient: boolean;
}

export function computeOpportunityScore(
  inputs: OpportunityScoreInputs,
  weights: OpportunityScoreWeights = DEFAULT_WEIGHTS,
): OpportunityScoreBreakdown {
  const confidence = clamp01(inputs.confidence ?? 0.5);
  const confidenceMultiplier = clamp01(confidence + weights.confidenceFloor);
  const liquidity = Math.max(0, inputs.liquidityCents ?? 0);
  const liquidityScore = clamp01(liquidity / weights.liquiditySaturationCents);
  const spread = Math.max(0, inputs.spreadCents ?? weights.spreadPenaltyCents);
  const spreadScore = clamp01(1 - spread / (weights.spreadPenaltyCents * 2));
  const secs = inputs.secondsToClose;
  const timeScore =
    secs == null || secs <= 0 ? 0.3 : clamp01(timeFalloff(secs, weights.idealSecondsToClose));
  const freshnessScore =
    inputs.dataAgeSec == null
      ? 0.8
      : clamp01(Math.pow(0.5, inputs.dataAgeSec / weights.freshnessDecaySec));
  const calibrationMultiplier = clamp01(inputs.calibrationScore ?? 0.5);

  // Structural axis: how worth-looking-at is this market regardless of model
  // disagreement?  Weighted sum of liquidity, spread tightness, time pressure,
  // and freshness.  Range 0..100.
  const structuralAxis =
    clamp01(0.4 * liquidityScore + 0.25 * spreadScore + 0.25 * timeScore + 0.1 * freshnessScore) *
    100;

  // Probability-diff axis: how large and how trustworthy is the gap?
  const { modelProbability, marketProbability } = inputs;
  let probDiff = 0;
  let probDiffAxis = 0;
  let insufficient = false;
  if (modelProbability == null || marketProbability == null) {
    insufficient = true;
  } else {
    probDiff = Math.abs(modelProbability - marketProbability);
    if (probDiff >= weights.minProbDiff) {
      // Scale the raw gap on a soft curve so a 10pt gap already scores
      // meaningfully (not just a 30pt gap maxing out).
      const gapScale = clamp01(probDiff / 0.15);
      probDiffAxis =
        clamp01(gapScale * (0.55 + 0.45 * confidenceMultiplier) * (0.6 + 0.4 * calibrationMultiplier)) *
        100;
    }
  }

  const score = Math.round((0.6 * probDiffAxis + 0.4 * structuralAxis) * 10) / 10;

  return {
    score,
    probDiffAxis: Math.round(probDiffAxis * 10) / 10,
    structuralAxis: Math.round(structuralAxis * 10) / 10,
    components: {
      probDiff,
      confidenceMultiplier,
      liquidityScore,
      spreadScore,
      timeScore,
      freshnessScore,
      calibrationMultiplier,
    },
    insufficient,
  };
}

function timeFalloff(secondsToClose: number, ideal: number): number {
  const ratio = secondsToClose / ideal;
  if (ratio <= 0) return 0;
  const log = Math.log10(ratio);
  return Math.exp(-(log * log) / 0.5);
}

// ─── Structural tags ─────────────────────────────────────────────────────────
//
// Lightweight signals that make a market worth looking at even when the model
// doesn't have an independent probability. Pure function on a KalshiMarket.
// Caller requires at least 1 (for "watch" tier) or 2 (for "possible" tier)
// before promoting the row in the UI.

export type MarketTag =
  | "wide_spread_active"
  | "closing_soon_wide"
  | "tail_pricing"
  | "uninformed_50"
  | "quiet_quote"
  | "arb_sum_low"
  | "arb_sum_high"
  | "rapid_repricing";

export interface MarketTagExplanation {
  tag: MarketTag;
  label: string;
  reason: string;
}

export const TAG_LABELS: Record<MarketTag, string> = {
  wide_spread_active: "wide buy/sell gap",
  closing_soon_wide: "closes soon with wide gap",
  tail_pricing: "priced at the extreme",
  uninformed_50: "untraded at 50¢",
  quiet_quote: "quoted but no trading",
  arb_sum_low: "YES prices sum below 100¢",
  arb_sum_high: "YES prices sum above 100¢",
  rapid_repricing: "price moved recently",
};

const TAG_REASONS: Record<MarketTag, string> = {
  wide_spread_active:
    "The gap between the YES buy and sell price is wide while trading is active — a limit order inside the spread can have real edge.",
  closing_soon_wide:
    "This market closes very soon and still has a wide buy/sell gap — late order flow often moves these prices.",
  tail_pricing:
    "The market is priced close to 0¢ or 100¢. These extreme prices are often anchored to the floor/cap rather than fundamentals.",
  uninformed_50:
    "The last price is exactly 50¢ and almost no one has traded — this is often the default for untraded markets.",
  quiet_quote:
    "A market maker is quoting both sides but there's been no trading today. The quote may not have been tested against new information.",
  arb_sum_low:
    "The YES prices across all outcomes in this event add up to less than 100¢ — buying every outcome would guarantee a profit (minus fees).",
  arb_sum_high:
    "The YES prices across all outcomes in this event add up to more than 100¢ — shorting every outcome would guarantee a profit (minus fees).",
  rapid_repricing:
    "The price moved substantially in the last couple of hours. Rapid repricing often overshoots.",
};

export function computeMarketTags(market: {
  yesBidCents: number | null;
  yesAskCents: number | null;
  spreadCents: number | null;
  lastPriceCents: number | null;
  volume24h: number;
  liquidityCents: number;
  secondsToClose: number | null;
}): MarketTagExplanation[] {
  const out: MarketTagExplanation[] = [];
  const spread = market.spreadCents ?? 0;
  const ask = market.yesAskCents;
  const last = market.lastPriceCents;
  const v24 = market.volume24h;
  const liq = market.liquidityCents;
  const secs = market.secondsToClose;

  const push = (tag: MarketTag) => out.push({ tag, label: TAG_LABELS[tag], reason: TAG_REASONS[tag] });

  if (spread >= 6 && v24 >= 50 && liq >= 1_000) push("wide_spread_active");
  if (secs != null && secs > 0 && secs <= 7200 && spread >= 4 && ask != null && ask >= 15 && ask <= 85) {
    push("closing_soon_wide");
  }
  if (ask != null && liq > 500 && (ask <= 4 || ask >= 96)) push("tail_pricing");
  if (last === 50 && v24 < 10 && liq > 500) push("uninformed_50");
  if (v24 === 0 && liq > 5_000) push("quiet_quote");

  return out;
}

/** Classify a market into a tier for UI promotion.  Rules:
 *
 *   edge     → opportunity score ≥ alertThreshold AND confidence ≥ minConfidence
 *   possible → score ≥ snapshotThreshold OR 2+ tags OR has an arb tag
 *   watch    → 1+ tag
 *   none     → otherwise
 */
export type OpportunityTier = "none" | "watch" | "possible" | "edge";

export function classifyTier(input: {
  score: number;
  confidence: number | null;
  tags: MarketTag[];
  alertThreshold: number;
  snapshotThreshold: number;
  minConfidence: number;
}): OpportunityTier {
  const hasArb = input.tags.some((t) => t === "arb_sum_low" || t === "arb_sum_high");
  if (
    input.score >= input.alertThreshold &&
    (input.confidence ?? 0) >= input.minConfidence
  ) {
    return "edge";
  }
  if (hasArb || input.score >= input.snapshotThreshold || input.tags.length >= 2) {
    return "possible";
  }
  if (input.tags.length >= 1) return "watch";
  return "none";
}

export function marketToTagInput(m: KalshiMarket): Parameters<typeof computeMarketTags>[0] {
  const spread =
    m.yesBidCents != null && m.yesAskCents != null ? Math.max(0, m.yesAskCents - m.yesBidCents) : null;
  const secondsToClose = m.closeTime
    ? Math.max(0, (new Date(m.closeTime).getTime() - Date.now()) / 1000)
    : null;
  return {
    yesBidCents: m.yesBidCents,
    yesAskCents: m.yesAskCents,
    spreadCents: spread,
    lastPriceCents: m.lastPriceCents,
    volume24h: m.volume24h,
    liquidityCents: m.liquidityCents,
    secondsToClose,
  };
}
