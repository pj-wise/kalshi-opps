// Shared helpers to turn flat scanner rows into event-grouped structures the
// card view consumes.  Lives in /lib so both server and client code can call
// into it without churn.

import type { ScannerRow } from "@/components/scanner/scanner-table";

export type EventKind = "binary" | "matchup" | "multi";

export interface EventGroup {
  key: string;
  eventTitle: string;
  category: string | null;
  seriesTicker: string | null;
  closeTime: string | null;
  rows: ScannerRow[];
  kind: EventKind;
  topScore: number | null;
  totalLiquidityCents: number;
  isOpportunity: boolean;
  onWatchlist: boolean;
  avgAbsGap: number | null;
  // Highest tier across member markets.
  topTier: ScannerRow["tier"];
  // Distinct tags across member markets.
  tags: string[];
}

const MATCHUP_KEYWORDS = /\bvs\b|\bv\.\b|\bat\b|@/i;

export function groupByEvent(rows: ScannerRow[]): EventGroup[] {
  // Markets without an event ticker become singleton groups keyed by ticker.
  const byKey = new Map<string, ScannerRow[]>();
  for (const r of rows) {
    const key = r.eventTicker ?? `__single__${r.ticker}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(r);
    else byKey.set(key, [r]);
  }

  const groups: EventGroup[] = [];
  for (const [key, members] of byKey.entries()) {
    const first = members[0];
    const closeTime = members
      .map((m) => m.closeTime)
      .filter((t): t is string => Boolean(t))
      .sort()[0] ?? null;
    const kind = classify(members, first);
    const totalLiquidityCents = members.reduce((acc, m) => acc + (m.liquidityCents ?? 0), 0);
    const topScore = members.reduce<number | null>((acc, m) => {
      if (m.opportunityScore == null) return acc;
      if (acc == null || m.opportunityScore > acc) return m.opportunityScore;
      return acc;
    }, null);
    const absGaps = members
      .map((m) => (m.diffPoints == null ? null : Math.abs(m.diffPoints)))
      .filter((v): v is number => v != null);
    const avgAbsGap =
      absGaps.length > 0 ? absGaps.reduce((a, b) => a + b, 0) / absGaps.length : null;
    const tierRank: Record<ScannerRow["tier"], number> = {
      none: 0,
      watch: 1,
      possible: 2,
      edge: 3,
    };
    const topTier = members.reduce<ScannerRow["tier"]>(
      (acc, m) => (tierRank[m.tier] > tierRank[acc] ? m.tier : acc),
      "none",
    );
    const tagSet = new Set<string>();
    for (const m of members) for (const t of m.tags) tagSet.add(t);
    groups.push({
      key,
      eventTitle: first.eventTitle,
      category: first.category,
      seriesTicker: first.seriesTicker,
      closeTime,
      rows: sortMembers(members, kind),
      kind,
      topScore,
      totalLiquidityCents,
      isOpportunity: members.some((m) => m.isOpportunity),
      onWatchlist: members.some((m) => m.onWatchlist),
      avgAbsGap,
      topTier,
      tags: Array.from(tagSet),
    });
  }

  return groups;
}

function classify(members: ScannerRow[], first: ScannerRow): EventKind {
  if (members.length === 1) return "binary";
  const looksLikeMatchup =
    members.length === 2 && MATCHUP_KEYWORDS.test(first.eventTitle);
  if (looksLikeMatchup) return "matchup";
  return "multi";
}

function sortMembers(members: ScannerRow[], kind: EventKind): ScannerRow[] {
  if (kind === "matchup") {
    // Stable "home / away" ordering: try to put the first-named team first by
    // matching the event title.
    const [home, away] = parseMatchup(members[0].eventTitle);
    if (home && away) {
      const homeRow = members.find((m) =>
        teamLabelMatches(m.outcomeLabel, home),
      );
      const awayRow = members.find((m) =>
        teamLabelMatches(m.outcomeLabel, away),
      );
      if (homeRow && awayRow && homeRow !== awayRow) return [homeRow, awayRow];
    }
    return members;
  }
  // Multi-outcome: sort by market YES price descending so the leader is first.
  return [...members].sort((a, b) => (b.yesPriceCents ?? 0) - (a.yesPriceCents ?? 0));
}

export function parseMatchup(title: string): [string, string] | [null, null] {
  const m = title.match(/^(.+?)\s+(?:vs\.?|v\.|at|@)\s+(.+)$/i);
  if (!m) return [null, null];
  return [m[1].trim(), m[2].trim()];
}

function teamLabelMatches(outcome: string | null, team: string): boolean {
  if (!outcome) return false;
  const o = outcome.toLowerCase();
  const t = team.toLowerCase();
  if (o === t) return true;
  const firstWord = t.split(/\s+/)[0];
  return o.includes(firstWord);
}
