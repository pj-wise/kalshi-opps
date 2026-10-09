// Compose a plain-English sentence explaining why a given event-group was
// classified as edge / possible / watch.  Used on the scanner cards so a
// first-time user can tell *why* the system flagged a market without
// decoding tag names.

import type { EventGroup } from "./event-groups";
import type { ScannerRow } from "@/components/scanner/scanner-table";
import type { MarketTag } from "./math/opportunity";

const PLAIN_TAG_SENTENCES: Record<MarketTag, string> = {
  arb_sum_low:
    "Buying every outcome in this event would guarantee a small profit — the prices don't add up to 100¢.",
  arb_sum_high:
    "The outcome prices in this event add up to more than 100¢, so there's a theoretical shorting edge.",
  wide_spread_active:
    "There's an unusually wide gap between the buy and sell prices while people are still actively trading — a limit order inside the gap can have real edge.",
  closing_soon_wide:
    "This market closes very soon and the buy/sell gap is still wide — late orders typically move the price here.",
  tail_pricing:
    "The price is sitting near 0¢ or 100¢ with real activity — those extremes often overshoot.",
  uninformed_50:
    "The price is stuck at 50¢ with almost no trading — nobody has pushed it off the default yet.",
  quiet_quote:
    "A market maker is quoting both sides but nobody has traded today, so the price hasn't been tested.",
  rapid_repricing:
    "The price moved sharply in the last couple of hours, which often overshoots.",
};

// Pick the single highest-signal row inside the group so we can quote its
// specific gap for the "worth a bet" sentence.
function pickTopRow(group: EventGroup): ScannerRow | null {
  const scored = group.rows.filter((r) => r.opportunityScore != null);
  if (scored.length === 0) return group.rows[0] ?? null;
  return scored.reduce((best, r) =>
    (r.opportunityScore ?? 0) > (best.opportunityScore ?? 0) ? r : best,
  );
}

function fmtPercent(p: number | null | undefined): string {
  if (p == null) return "—";
  return `${Math.round(p * 100)}%`;
}

export interface TierReason {
  // Short label used in the tier pill (we keep the current one).
  pill: string;
  // One or two sentences shown on the card.
  sentence: string;
}

export function tierReason(group: EventGroup): TierReason | null {
  if (group.topTier === "none") return null;

  const top = pickTopRow(group);
  const hasModel =
    top != null &&
    top.modelProbability != null &&
    top.marketProbability != null &&
    top.modelStatus === "ok";
  const gapPts = top?.diffPoints ?? null;

  const arbTag = group.tags.find((t): t is MarketTag => t === "arb_sum_low" || t === "arb_sum_high");
  const otherTags = group.tags.filter(
    (t): t is MarketTag => t in PLAIN_TAG_SENTENCES && t !== "arb_sum_low" && t !== "arb_sum_high",
  );

  if (group.topTier === "edge") {
    if (hasModel && top && gapPts != null && Math.abs(gapPts) >= 3) {
      const direction = gapPts > 0 ? "more likely" : "less likely";
      const side = top.outcomeLabel ? ` for ${top.outcomeLabel}` : "";
      const marketPrice =
        top.yesPriceCents != null ? `${top.yesPriceCents}¢` : fmtPercent(top.marketProbability);
      const sentence =
        `We think YES${side} is ${direction} than the market says — ` +
        `our estimate is ${fmtPercent(top.modelProbability)} vs the market price of ${marketPrice}, ` +
        `a ${Math.abs(Math.round(gapPts))}-point gap.`;
      return { pill: "worth a bet", sentence };
    }
    if (arbTag) {
      return { pill: "worth a bet", sentence: PLAIN_TAG_SENTENCES[arbTag] };
    }
    // Fallback — shouldn't really happen since edge requires either model or arb.
    return {
      pill: "worth a bet",
      sentence:
        "This market scored high on our interest ranking across model estimate, liquidity, and timing.",
    };
  }

  if (group.topTier === "possible") {
    if (arbTag) {
      return { pill: "worth a look", sentence: PLAIN_TAG_SENTENCES[arbTag] };
    }
    if (otherTags.length >= 1) {
      const primary = otherTags[0];
      let sentence = PLAIN_TAG_SENTENCES[primary];
      if (otherTags.length > 1) {
        sentence += ` It also shows ${otherTags.length - 1} other signal${otherTags.length - 1 === 1 ? "" : "s"}.`;
      }
      return { pill: "worth a look", sentence };
    }
    if (hasModel && gapPts != null && Math.abs(gapPts) >= 2) {
      return {
        pill: "worth a look",
        sentence:
          `Our estimate (${fmtPercent(top?.modelProbability)}) differs from the market ` +
          `by ${Math.abs(Math.round(gapPts))} points — modest but worth checking.`,
      };
    }
    return {
      pill: "worth a look",
      sentence: "This market scored above our interest threshold on structure (liquidity + spread + time).",
    };
  }

  // watch
  if (otherTags[0]) {
    return { pill: "signal", sentence: PLAIN_TAG_SENTENCES[otherTags[0]] };
  }
  if (arbTag) {
    return { pill: "signal", sentence: PLAIN_TAG_SENTENCES[arbTag] };
  }
  return null;
}
