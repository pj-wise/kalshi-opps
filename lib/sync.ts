// Pull Kalshi markets into the DB, run model estimates, write snapshots.
//
// Two modes:
//   - full: enumerate every open series via /events, then fetch each one's
//     markets.  Comprehensive (10k+ markets across all categories) but takes
//     several minutes.  Use this on seed + occasional manual refreshes.
//   - fast: refresh only series we already have markets for in the DB.  Takes
//     ~30s and keeps the dashboard current without a full re-crawl.

import { prisma } from "@/lib/prisma";
import { KalshiClient, listMarkets } from "@/lib/kalshi";
import { loadEventMeta, loadEventMetaForSeries } from "@/lib/kalshi/markets";
import type { KalshiMarket } from "@/lib/kalshi/types";
import { estimateForMarket } from "@/lib/models/registry";
import {
  classifyTier,
  computeMarketTags,
  computeOpportunityScore,
  marketToTagInput,
  type MarketTag,
} from "@/lib/math/opportunity";
import { detectEventArbs } from "@/lib/opportunities/event-arb";
import {
  midImpliedProbability,
  spreadCents as computeSpread,
} from "@/lib/math/probability";
import { readSettings, toOpportunityWeights } from "@/lib/settings";
import { maybePruneHistory } from "@/lib/retention";

export interface SyncResult {
  marketsScanned: number;
  snapshotsCreated: number;
  estimatesCreated: number;
  opportunities: number;
  startedAt: string;
  finishedAt: string;
  dataSource: "live" | "mock-forced" | "mock-fallback";
  fallbackReason?: string;
  mode: "full" | "fast";
}

export interface SyncOptions {
  mode?: "full" | "fast";
}

const EXCLUDED_SERIES = new Set(["KXMVECROSSCATEGORY", "KXMVECROSSCATEGORY0"]);
// Series we always fetch even if they haven't appeared in the general event
// feed — mostly weekly game lines for sports.
const ALWAYS_FETCH_SERIES = [
  "KXNFLGAME",
  "KXNBAGAME",
  "KXMLBGAME",
  "KXNHLGAME",
  "KXWNBAGAME",
  "KXMLSGAME",
  "KXEPLGAME",
  "KXUFCGAME",
  "KXNCAAFGAME",
];

export async function syncMarkets(
  client: KalshiClient = new KalshiClient(),
  options: SyncOptions = {},
): Promise<SyncResult> {
  const mode = options.mode ?? "fast";
  const result = mode === "full" ? await fullSync(client) : await fastSync(client);
  try {
    const pruned = await maybePruneHistory();
    if (pruned) console.log("[sync] pruned history", pruned);
  } catch (err) {
    console.error("[sync] history prune failed", err);
  }
  return result;
}

async function fullSync(client: KalshiClient): Promise<SyncResult> {
  const startedAt = new Date();
  const settings = await readSettings();
  const weights = toOpportunityWeights(settings);

  // Pull event metadata once (default status=open).
  const eventMeta = client.env.mockMode
    ? new Map()
    : await loadEventMeta(client, { paginate: true }).catch((err) => {
        console.warn("[sync] loadEventMeta failed:", (err as Error).message);
        return new Map();
      });

  const seriesToFetch = new Set<string>();
  for (const meta of eventMeta.values()) {
    if (meta.seriesTicker && !EXCLUDED_SERIES.has(meta.seriesTicker)) {
      seriesToFetch.add(meta.seriesTicker);
    }
  }
  for (const s of ALWAYS_FETCH_SERIES) seriesToFetch.add(s);

  console.log(`[sync:full] fetching ${seriesToFetch.size} series`);
  const { markets, source, fallbackReason } = await fetchSeriesSet(
    client,
    seriesToFetch,
    eventMeta,
  );

  // Fill any still-missing event metadata by series lookup.
  if (!client.env.mockMode) {
    const missingSeries = new Set<string>();
    for (const m of markets) {
      if (!m.category && m.seriesTicker) missingSeries.add(m.seriesTicker);
    }
    if (missingSeries.size > 0) {
      await loadEventMetaForSeries(client, missingSeries, eventMeta);
      backfillMetaOnMarkets(markets, eventMeta);
    }
  }

  const counts = await processMarkets(markets, settings, weights);
  await writeLastSyncRecord(startedAt, markets.length, source, fallbackReason, "full");
  return {
    ...counts,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    dataSource: source,
    fallbackReason,
    mode: "full",
    marketsScanned: markets.length,
  };
}

async function fastSync(client: KalshiClient): Promise<SyncResult> {
  const startedAt = new Date();
  const settings = await readSettings();
  const weights = toOpportunityWeights(settings);

  // Choose the most relevant ~100 series so fast sync stays under a minute.
  // Priority order:
  //   1. Series containing any watchlisted market.
  //   2. Series containing any opportunity-flagged estimate from the last hour.
  //   3. Series closing soonest (closeTime nearest now in the future).
  //   4. Series with the highest cumulative open interest.
  // Then always include the hard-coded ALWAYS_FETCH_SERIES so weekly game
  // lines show up.
  const FAST_SERIES_CAP = 120;
  const seriesToFetch = new Set<string>();

  // 1. Watchlist series
  const watchlistSeries = await prisma.market.findMany({
    where: { watchlistItem: { isNot: null }, seriesTicker: { not: null } },
    select: { seriesTicker: true },
    distinct: ["seriesTicker"],
  });
  for (const r of watchlistSeries) {
    if (r.seriesTicker) seriesToFetch.add(r.seriesTicker);
  }

  // 2. Opportunity series (last hour)
  const oppRows = await prisma.$queryRawUnsafe<{ seriesTicker: string }[]>(`
    SELECT DISTINCT m.seriesTicker AS seriesTicker
    FROM Market m
    JOIN ModelEstimate e ON e.marketId = m.id
    WHERE m.seriesTicker IS NOT NULL
      AND e.createdAt > datetime('now', '-1 hour')
      AND e.opportunityScore >= ${settings.alertMinOpportunityScore}
    LIMIT 50
  `);
  for (const r of oppRows) {
    if (r.seriesTicker) seriesToFetch.add(r.seriesTicker);
  }

  // 3. Soonest-closing series
  const soonRows = await prisma.$queryRawUnsafe<{ seriesTicker: string }[]>(`
    SELECT DISTINCT seriesTicker
    FROM Market
    WHERE status IN ('active','unopened')
      AND seriesTicker IS NOT NULL
      AND closeTime > datetime('now')
    ORDER BY closeTime ASC
    LIMIT 60
  `);
  for (const r of soonRows) {
    if (r.seriesTicker) seriesToFetch.add(r.seriesTicker);
  }

  // 4. Fill remaining slots with highest-liquidity series.
  if (seriesToFetch.size < FAST_SERIES_CAP) {
    const topRows = await prisma.$queryRawUnsafe<{ seriesTicker: string }[]>(`
      SELECT seriesTicker
      FROM Market
      WHERE status IN ('active','unopened')
        AND seriesTicker IS NOT NULL
      GROUP BY seriesTicker
      ORDER BY SUM(liquidityCents) DESC
      LIMIT ${FAST_SERIES_CAP}
    `);
    for (const r of topRows) {
      if (seriesToFetch.size >= FAST_SERIES_CAP) break;
      if (r.seriesTicker) seriesToFetch.add(r.seriesTicker);
    }
  }

  for (const s of ALWAYS_FETCH_SERIES) seriesToFetch.add(s);
  for (const s of EXCLUDED_SERIES) seriesToFetch.delete(s);

  // Share event metadata we've accumulated from past syncs (via the Market
  // table's own category/title) so this run doesn't re-crawl /events.  New
  // events in known series will still get picked up as long as their series
  // ticker is already seen.
  const eventMeta = new Map();

  console.log(`[sync:fast] refreshing ${seriesToFetch.size} known series`);
  const { markets, source, fallbackReason } = await fetchSeriesSet(
    client,
    seriesToFetch,
    eventMeta,
  );

  // For NEW events (ones we don't yet have category for), do a lightweight
  // metadata backfill by series.
  if (!client.env.mockMode) {
    const missingSeries = new Set<string>();
    for (const m of markets) {
      if (!m.category && m.seriesTicker) missingSeries.add(m.seriesTicker);
    }
    if (missingSeries.size > 0) {
      await loadEventMetaForSeries(client, missingSeries, eventMeta);
      backfillMetaOnMarkets(markets, eventMeta);
    }
  }

  const counts = await processMarkets(markets, settings, weights);
  await writeLastSyncRecord(startedAt, markets.length, source, fallbackReason, "fast");
  return {
    ...counts,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    dataSource: source,
    fallbackReason,
    mode: "fast",
    marketsScanned: markets.length,
  };
}

async function fetchSeriesSet(
  client: KalshiClient,
  seriesToFetch: Set<string>,
  eventMeta: Map<string, { title: string; category: string | null; seriesTicker: string | null; subTitle: string | null }>,
): Promise<{
  markets: KalshiMarket[];
  source: "live" | "mock-forced" | "mock-fallback";
  fallbackReason?: string;
}> {
  const byTicker = new Map<string, KalshiMarket>();
  let source: "live" | "mock-forced" | "mock-fallback" = "live";
  let fallbackReason: string | undefined;
  for (const seriesTicker of seriesToFetch) {
    const page = await listMarkets(
      client,
      { seriesTicker, limit: 500, paginate: false },
      eventMeta,
    );
    if (page.source !== "live") {
      source = page.source;
      fallbackReason = page.fallbackReason;
    }
    for (const m of page.markets) {
      if (m.seriesTicker && EXCLUDED_SERIES.has(m.seriesTicker)) continue;
      byTicker.set(m.ticker, m);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { markets: Array.from(byTicker.values()), source, fallbackReason };
}

function backfillMetaOnMarkets(
  markets: KalshiMarket[],
  eventMeta: Map<string, { title: string; category: string | null; seriesTicker: string | null; subTitle: string | null }>,
): void {
  for (let i = 0; i < markets.length; i++) {
    const m = markets[i];
    if (m.category || !m.eventTicker) continue;
    const meta = eventMeta.get(m.eventTicker);
    if (!meta) continue;
    const outcome = m.yesSubTitle ?? m.subtitle;
    const base = meta.title;
    const title =
      outcome && !base.toLowerCase().includes(outcome.toLowerCase())
        ? `${base} · ${outcome}`
        : base;
    markets[i] = {
      ...m,
      title,
      category: m.category ?? meta.category,
      seriesTicker: m.seriesTicker ?? meta.seriesTicker,
      subtitle: m.subtitle ?? meta.subTitle,
    };
  }
}

async function processMarkets(
  mergedMarkets: KalshiMarket[],
  settings: Awaited<ReturnType<typeof readSettings>>,
  weights: ReturnType<typeof toOpportunityWeights>,
): Promise<{ snapshotsCreated: number; estimatesCreated: number; opportunities: number }> {
  let snapshotsCreated = 0;
  let estimatesCreated = 0;
  let opportunities = 0;

  // Event-level arb detection runs over the full batch before per-market loop.
  const { arbs } = detectEventArbs(mergedMarkets);

  for (const m of mergedMarkets) {
    const market = await upsertMarket(m);
    snapshotsCreated += await writeSnapshot(market.id, m);
    const marketProb = midImpliedProbability(m.yesBidCents, m.yesAskCents, m.lastPriceCents);
    const spread = computeSpread(m.yesBidCents, m.yesAskCents);
    const { model, estimate } = await estimateForMarket(m);
    const secondsToClose = m.closeTime
      ? Math.max(0, (new Date(m.closeTime).getTime() - Date.now()) / 1000)
      : null;
    const scoring = computeOpportunityScore(
      {
        modelProbability: estimate.probability ?? null,
        marketProbability: marketProb,
        confidence: estimate.confidence ?? null,
        liquidityCents: m.liquidityCents,
        spreadCents: spread,
        secondsToClose,
        dataAgeSec: 0,
      },
      weights,
    );
    const structuralTags = computeMarketTags(marketToTagInput(m)).map((t) => t.tag);
    const tags: MarketTag[] = [...structuralTags];
    const arbKind = m.eventTicker ? arbs.get(m.eventTicker) : undefined;
    if (arbKind === "low") tags.push("arb_sum_low");
    else if (arbKind === "high") tags.push("arb_sum_high");
    const tier = classifyTier({
      score: scoring.score,
      confidence: estimate.confidence ?? null,
      tags,
      alertThreshold: settings.alertMinOpportunityScore,
      snapshotThreshold: settings.snapshotMinOpportunityScore,
      minConfidence: settings.minConfidence,
    });
    const diffPoints =
      estimate.probability != null && marketProb != null
        ? (estimate.probability - marketProb) * 100
        : null;
    const row = await prisma.modelEstimate.create({
      data: {
        marketId: market.id,
        modelId: model.id,
        modelVersion: estimate.modelVersion,
        status: estimate.status,
        probability: estimate.probability ?? null,
        confidence: estimate.confidence ?? null,
        marketProbability: marketProb,
        diffPoints,
        opportunityScore: scoring.insufficient && tags.length === 0 ? null : scoring.score,
        tier,
        tags: tags.length > 0 ? tags.join(",") : null,
        spreadCents: spread,
        liquidityCents: m.liquidityCents,
        explanation: estimate.explanation ?? null,
        notes: estimate.notes ?? null,
        inputs: {
          create: estimate.inputs.map((inp) => ({
            source: inp.source,
            key: inp.key,
            value: JSON.stringify(inp.value),
            weight: inp.weight,
            contribution: inp.contribution ?? null,
            timestamp: inp.timestamp,
            freshnessSec: inp.freshnessSec ?? null,
            metadata: (inp.metadata ?? undefined) as never,
          })),
        },
      },
    });
    estimatesCreated += 1;
    if (tier === "possible" || tier === "edge") {
      opportunities += 1;
      await prisma.dataSourceRecord.upsert({
        where: { source_key: { source: "opportunity_snapshot", key: `${market.ticker}-${row.id}` } },
        create: {
          source: "opportunity_snapshot",
          key: `${market.ticker}-${row.id}`,
          value: JSON.stringify({
            estimateId: row.id,
            score: scoring.score,
            components: scoring.components,
          }),
          retrievedAt: new Date(),
        },
        update: {},
      });
    }
  }
  return { snapshotsCreated, estimatesCreated, opportunities };
}

async function writeLastSyncRecord(
  startedAt: Date,
  marketsScanned: number,
  dataSource: "live" | "mock-forced" | "mock-fallback",
  fallbackReason: string | undefined,
  mode: "full" | "fast",
): Promise<void> {
  const payload = {
    startedAt,
    finishedAt: new Date(),
    marketsScanned,
    dataSource,
    fallbackReason: fallbackReason ?? null,
    mode,
  };
  await prisma.appSetting.upsert({
    where: { key: "last_sync" },
    create: { key: "last_sync", value: JSON.stringify(payload) },
    update: { value: JSON.stringify(payload) },
  });
}

async function upsertMarket(m: KalshiMarket) {
  const common = {
    ticker: m.ticker,
    eventTicker: m.eventTicker ?? null,
    seriesTicker: m.seriesTicker ?? null,
    title: m.title,
    subtitle: m.subtitle ?? null,
    category: m.category ?? null,
    status: m.status,
    yesSubTitle: m.yesSubTitle ?? null,
    noSubTitle: m.noSubTitle ?? null,
    rulesPrimary: m.rulesPrimary ?? null,
    rulesSecondary: m.rulesSecondary ?? null,
    openTime: m.openTime ? new Date(m.openTime) : null,
    closeTime: m.closeTime ? new Date(m.closeTime) : null,
    expirationTime: m.expirationTime ? new Date(m.expirationTime) : null,
    settlementValue: m.settlementValue ?? null,
    settlementSource: m.settlementSource ?? null,
    lastYesBidCents: m.yesBidCents ?? null,
    lastYesAskCents: m.yesAskCents ?? null,
    lastNoBidCents: m.noBidCents ?? null,
    lastNoAskCents: m.noAskCents ?? null,
    lastPriceCents: m.lastPriceCents ?? null,
    volume: m.volume,
    volume24h: m.volume24h,
    openInterest: m.openInterest,
    liquidityCents: m.liquidityCents,
    providerMeta: (m.providerMeta ?? undefined) as never,
    lastFetchedAt: new Date(),
  };
  return prisma.market.upsert({
    where: { ticker: m.ticker },
    create: common,
    update: common,
  });
}

async function writeSnapshot(marketId: string, m: KalshiMarket): Promise<number> {
  const spread = computeSpread(m.yesBidCents, m.yesAskCents);
  await prisma.marketSnapshot.create({
    data: {
      marketId,
      yesBidCents: m.yesBidCents ?? null,
      yesAskCents: m.yesAskCents ?? null,
      noBidCents: m.noBidCents ?? null,
      noAskCents: m.noAskCents ?? null,
      lastPriceCents: m.lastPriceCents ?? null,
      volume: m.volume,
      openInterest: m.openInterest,
      liquidityCents: m.liquidityCents,
      spreadCents: spread,
    },
  });
  return 1;
}
