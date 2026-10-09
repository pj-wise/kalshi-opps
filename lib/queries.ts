// Server-only Prisma queries that the pages consume.
import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { brierScore } from "@/lib/math/probability";
import { expectedROI } from "@/lib/math/probability";
import type { ScannerRow } from "@/components/scanner/scanner-table";
import type { SummaryStats } from "@/components/scanner/summary-cards";
import { readSettings } from "@/lib/settings";

/** Latest estimate per market, joined with market data. */
export async function getScannerRows(): Promise<ScannerRow[]> {
  const settings = await readSettings();
  const markets = await prisma.market.findMany({
    where: { status: { in: ["active", "unopened"] } },
    include: { watchlistItem: true },
    orderBy: { lastFetchedAt: "desc" },
    take: 3000,
  });

  // Latest estimate per market. Prisma's `include: { estimates: { take: 1 } }`
  // loads every estimate for every market and trims in memory, which takes
  // seconds once history builds up; this walks the (marketId, createdAt) index.
  const latestIds =
    markets.length === 0
      ? []
      : await prisma.$queryRaw<{ id: string }[]>`
          SELECT (
            SELECT e.id FROM ModelEstimate e
            WHERE e.marketId = m.id
            ORDER BY e.createdAt DESC
            LIMIT 1
          ) AS id
          FROM Market m
          WHERE m.id IN (${Prisma.join(markets.map((m) => m.id))})
        `;
  const estimates = await prisma.modelEstimate.findMany({
    where: { id: { in: latestIds.map((r) => r.id).filter(Boolean) } },
  });
  const estimateByMarket = new Map(estimates.map((e) => [e.marketId, e]));

  return markets.map((m) => {
    const est = estimateByMarket.get(m.id);
    const yesAsk = m.lastYesAskCents ?? null;
    const yesBid = m.lastYesBidCents ?? null;
    const noAsk = m.lastNoAskCents ?? null;
    const yesPriceCents = yesAsk ?? yesBid ?? m.lastPriceCents ?? null;
    const noPriceCents = noAsk ?? (yesPriceCents != null ? 100 - yesPriceCents : null);
    const spread =
      yesAsk != null && yesBid != null ? Math.max(0, yesAsk - yesBid) : null;
    const diffPoints = est?.diffPoints ?? null;
    const modelProbability = est?.probability ?? null;
    const expectedRoiBps = (() => {
      if (!est || est.probability == null || yesAsk == null) return null;
      // Prefer YES side when model > market, NO side when model < market.
      const marketProb = est.marketProbability ?? null;
      if (marketProb == null) return null;
      const side = est.probability > marketProb ? "yes" : "no";
      const ask = side === "yes" ? yesAsk : noAsk ?? 100 - yesAsk;
      const roi = expectedROI(side, est.probability, ask);
      return roi != null ? Math.round(roi * 10_000) : null;
    })();
    const opportunityScore = est?.opportunityScore ?? null;
    const tier = (est?.tier as ScannerRow["tier"] | undefined) ?? "none";
    const tags = est?.tags ? est.tags.split(",").filter(Boolean) : [];
    const isOpportunity = tier === "possible" || tier === "edge";
    // Pull the sub-outcome label out of the title (everything after " · ").
    const dotIdx = m.title.indexOf(" · ");
    const outcomeLabel = dotIdx >= 0 ? m.title.slice(dotIdx + 3) : null;
    const eventTitle = dotIdx >= 0 ? m.title.slice(0, dotIdx) : m.title;
    return {
      ticker: m.ticker,
      title: m.title,
      eventTicker: m.eventTicker,
      eventTitle,
      outcomeLabel,
      seriesTicker: m.seriesTicker,
      category: m.category,
      yesPriceCents,
      noPriceCents,
      modelProbability,
      marketProbability: est?.marketProbability ?? null,
      diffPoints,
      expectedRoiBps,
      confidence: est?.confidence ?? null,
      liquidityCents: m.liquidityCents,
      spreadCents: spread,
      volume: m.volume,
      closeTime: m.closeTime ? m.closeTime.toISOString() : null,
      status: m.status,
      opportunityScore,
      modelStatus: (est?.status as ScannerRow["modelStatus"]) ?? "insufficient_data",
      modelId: est?.modelId ?? null,
      tier,
      tags,
      isOpportunity: Boolean(isOpportunity),
      onWatchlist: Boolean(m.watchlistItem),
    } satisfies ScannerRow;
  });
}

export async function getCategories(): Promise<string[]> {
  const rows = await prisma.market.findMany({
    select: { category: true },
    where: { category: { not: null } },
    distinct: ["category"],
  });
  return rows.map((r) => r.category).filter((c): c is string => Boolean(c)).sort();
}

export async function getSummaryStats(): Promise<SummaryStats> {
  const settings = await readSettings();
  const [marketsScanned, estimateAgg, paperAgg, resolvedPaper, lastSyncSetting] = await Promise.all([
    prisma.market.count({ where: { status: { in: ["active", "unopened"] } } }),
    // Aggregate in SQL: the last 24h holds ~1M estimate rows once auto-refresh
    // has been running, far too many to pull into JS.
    prisma.$queryRaw<{ avgAbsDiff: number | null; opportunities: bigint | null }[]>`
      SELECT AVG(ABS(diffPoints)) AS avgAbsDiff,
             SUM(tier IN ('possible', 'edge')) AS opportunities
      FROM ModelEstimate
      WHERE createdAt >= ${Date.now() - 1000 * 60 * 60 * 24}
    `,
    prisma.paperTrade.aggregate({
      _sum: { pnlCents: true },
      where: { status: "resolved" },
    }),
    prisma.paperTrade.findMany({
      where: { status: "resolved", modelProbability: { not: null }, correct: { not: null } },
      select: { modelProbability: true, correct: true },
    }),
    prisma.appSetting.findUnique({ where: { key: "last_sync" } }),
  ]);

  const avgDiffPoints = estimateAgg[0]?.avgAbsDiff ?? null;
  const opportunities = Number(estimateAgg[0]?.opportunities ?? 0);
  const brierSum = resolvedPaper.reduce((acc, p) => {
    const prob = p.modelProbability ?? 0;
    const actual = p.correct ? 1 : 0;
    return acc + brierScore(prob, actual as 0 | 1);
  }, 0);
  const brier = resolvedPaper.length > 0 ? brierSum / resolvedPaper.length : null;

  let lastSync: string | null = null;
  let dataSource: "live" | "mock-forced" | "mock-fallback" | "unknown" = "unknown";
  let fallbackReason: string | null = null;
  if (lastSyncSetting) {
    try {
      const parsed = JSON.parse(lastSyncSetting.value) as {
        finishedAt?: string;
        dataSource?: "live" | "mock-forced" | "mock-fallback";
        fallbackReason?: string | null;
      };
      lastSync = parsed.finishedAt ?? null;
      dataSource = parsed.dataSource ?? "unknown";
      fallbackReason = parsed.fallbackReason ?? null;
    } catch {
      /* ignore */
    }
  }

  return {
    marketsScanned,
    opportunities,
    avgDiffPoints,
    paperPnlCents: paperAgg._sum.pnlCents ?? 0,
    brierScore: brier,
    resolvedCount: resolvedPaper.length,
    lastSync,
    dataSource,
    fallbackReason,
  };
}
