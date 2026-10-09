// Pure probability / finance helpers.
//
// Conventions:
//   - All probabilities are 0-1 floats. Never 0-100.
//   - All prices and bankroll are integer cents.
//   - A Kalshi contract settles at either 100¢ (YES wins) or 0¢.
//   - Market YES "price" in cents is treated as the market-implied probability
//     of YES ÷ 100.

export const CONTRACT_VALUE_CENTS = 100;

export function clamp01(p: number): number {
  if (Number.isNaN(p)) return 0;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/** Convert a 0-100 cent price to a 0-1 probability. */
export function centsToProbability(cents: number): number {
  return clamp01(cents / CONTRACT_VALUE_CENTS);
}

/** Convert a 0-1 probability to a 0-100 cent price (integer). */
export function probabilityToCents(p: number): number {
  return Math.round(clamp01(p) * CONTRACT_VALUE_CENTS);
}

/** Mid-market implied YES probability from bid/ask in cents. */
export function midImpliedProbability(
  yesBidCents: number | null | undefined,
  yesAskCents: number | null | undefined,
  lastPriceCents?: number | null,
): number | null {
  if (yesBidCents != null && yesAskCents != null) {
    return centsToProbability((yesBidCents + yesAskCents) / 2);
  }
  if (lastPriceCents != null) return centsToProbability(lastPriceCents);
  if (yesAskCents != null) return centsToProbability(yesAskCents);
  if (yesBidCents != null) return centsToProbability(yesBidCents);
  return null;
}

/** Yes bid/ask spread in cents (≥0). */
export function spreadCents(
  yesBidCents: number | null | undefined,
  yesAskCents: number | null | undefined,
): number | null {
  if (yesBidCents == null || yesAskCents == null) return null;
  const diff = yesAskCents - yesBidCents;
  return diff < 0 ? 0 : diff;
}

/**
 * Expected value in cents per contract, after a simple cost model.
 *
 *   EV_YES  = modelP * (100 - askCents) - (1 - modelP) * askCents - fee
 *   EV_NO   = (1 - modelP) * (100 - noAskCents) - modelP * noAskCents - fee
 *
 * modelProbability is 0-1 (YES). Fee is in cents; defaults to 0.
 */
export function expectedValueCentsPerContract(
  side: "yes" | "no",
  modelProbability: number,
  askCents: number,
  feeCents = 0,
): number {
  const p = clamp01(modelProbability);
  if (side === "yes") {
    return p * (CONTRACT_VALUE_CENTS - askCents) - (1 - p) * askCents - feeCents;
  }
  const q = 1 - p;
  return q * (CONTRACT_VALUE_CENTS - askCents) - p * askCents - feeCents;
}

/**
 * Expected return on investment per contract. Returns a 0-1 ratio
 * (e.g. 0.05 = +5%).  askCents must be > 0.
 */
export function expectedROI(
  side: "yes" | "no",
  modelProbability: number,
  askCents: number,
  feeCents = 0,
): number | null {
  if (askCents <= 0) return null;
  const ev = expectedValueCentsPerContract(side, modelProbability, askCents, feeCents);
  return ev / askCents;
}

/**
 * Full-Kelly fraction of bankroll for a binary bet.
 *
 *   f* = (b*p - q) / b
 *
 * where b = payoff odds (netWin/stake), p = win prob, q = 1 - p.
 * Returns 0 when the bet has non-positive edge, clamped to [0, 1].
 */
export function fullKellyFraction(
  side: "yes" | "no",
  modelProbability: number,
  askCents: number,
): number {
  if (askCents <= 0 || askCents >= CONTRACT_VALUE_CENTS) return 0;
  const p = side === "yes" ? clamp01(modelProbability) : clamp01(1 - modelProbability);
  const q = 1 - p;
  const stake = askCents;
  const netWin = CONTRACT_VALUE_CENTS - askCents;
  const b = netWin / stake;
  if (b <= 0) return 0;
  const f = (b * p - q) / b;
  if (!Number.isFinite(f) || f <= 0) return 0;
  return Math.min(f, 1);
}

/** Fractional Kelly stake in cents given a bankroll in cents and a fraction (e.g. 0.25). */
export function kellyStakeCents(
  side: "yes" | "no",
  modelProbability: number,
  askCents: number,
  bankrollCents: number,
  fraction = 0.25,
): number {
  if (bankrollCents <= 0) return 0;
  const kelly = fullKellyFraction(side, modelProbability, askCents);
  const raw = bankrollCents * kelly * fraction;
  // Guard against IEEE-754 "0.6 - 0.4 = 0.19999…" style drift.
  const sized = Math.floor(raw + 1e-9);
  return sized < 0 ? 0 : sized;
}

/** Brier score for a single prediction. 0 is perfect, 1 is worst. */
export function brierScore(predicted: number, actual: 0 | 1): number {
  const p = clamp01(predicted);
  const diff = p - actual;
  return diff * diff;
}

/** Log loss for a single prediction. Clamped to avoid -Infinity. */
export function logLoss(predicted: number, actual: 0 | 1, epsilon = 1e-6): number {
  const p = Math.min(1 - epsilon, Math.max(epsilon, clamp01(predicted)));
  return actual === 1 ? -Math.log(p) : -Math.log(1 - p);
}

/**
 * Paper-trade P&L given a resolution.
 *
 * Returns pnlCents (profit, can be negative), roi (0-1 return on cost),
 * and whether the prediction was correct.
 */
export function paperTradePnl(
  side: "yes" | "no",
  entryPriceCents: number,
  contracts: number,
  outcome: "yes" | "no" | "void",
): { pnlCents: number; roi: number; correct: boolean | null; resolvedValueCents: number } {
  const cost = entryPriceCents * contracts;
  if (outcome === "void") {
    return { pnlCents: 0, roi: 0, correct: null, resolvedValueCents: cost };
  }
  const payoutPerContract = outcome === side ? CONTRACT_VALUE_CENTS : 0;
  const resolvedValueCents = payoutPerContract * contracts;
  const pnlCents = resolvedValueCents - cost;
  const roi = cost > 0 ? pnlCents / cost : 0;
  return {
    pnlCents,
    roi,
    correct: outcome === side,
    resolvedValueCents,
  };
}
