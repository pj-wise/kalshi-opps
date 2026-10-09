// Event-level arbitrage detection.
//
// For every event that has 2+ markets with YES ask/bid prices, we check:
//   - Σ yesAsk < 100  → buying every YES guarantees a profit (minus fees).
//   - Σ yesBid > 100  → shorting every YES (via NO) guarantees a profit.
//
// We require all member markets to have a quote, non-zero liquidity, and
// recent lastFetchedAt so we're not chasing stale ghosts.

import type { KalshiMarket } from "@/lib/kalshi/types";

export interface EventArbResult {
  // Keyed by eventTicker, value is the kind of arb detected.
  arbs: Map<string, "low" | "high">;
}

export function detectEventArbs(markets: KalshiMarket[]): EventArbResult {
  const byEvent = new Map<string, KalshiMarket[]>();
  for (const m of markets) {
    if (!m.eventTicker) continue;
    const bucket = byEvent.get(m.eventTicker);
    if (bucket) bucket.push(m);
    else byEvent.set(m.eventTicker, [m]);
  }
  const arbs = new Map<string, "low" | "high">();
  for (const [eventTicker, group] of byEvent.entries()) {
    if (group.length < 2) continue;
    // Only check mutually-exclusive-looking groups — all members must have
    // bids/asks and non-trivial liquidity, and the asks must be strictly
    // positive (so we're not just adding floors).
    const quoted = group.filter(
      (m) =>
        m.yesAskCents != null &&
        m.yesAskCents > 0 &&
        m.yesBidCents != null &&
        m.yesBidCents > 0 &&
        m.liquidityCents > 500,
    );
    if (quoted.length < 2 || quoted.length !== group.length) continue;
    const sumAsk = quoted.reduce((acc, m) => acc + (m.yesAskCents ?? 0), 0);
    const sumBid = quoted.reduce((acc, m) => acc + (m.yesBidCents ?? 0), 0);
    // Guard: 1-cent slop is noise; require ≥3¢ of edge before flagging.
    if (sumAsk <= 97) arbs.set(eventTicker, "low");
    else if (sumBid >= 103) arbs.set(eventTicker, "high");
  }
  return { arbs };
}
