import "server-only";

import { prisma } from "@/lib/prisma";
import { KalshiClient, getOrderbook } from "@/lib/kalshi";
import { expectedROI, midImpliedProbability } from "@/lib/math/probability";
import type { PricePoint } from "@/components/market/price-history-chart";
import type { ModelInputRow } from "@/components/market/model-inputs-table";

export interface MarketDetail {
  marketRow: Awaited<ReturnType<typeof prisma.market.findUnique>>;
  latestEstimate: {
    id: string;
    modelId: string;
    modelVersion: string;
    status: "ok" | "insufficient_data" | "error";
    probability: number | null;
    confidence: number | null;
    marketProbability: number | null;
    diffPoints: number | null;
    opportunityScore: number | null;
    explanation: string | null;
    notes: string | null;
    createdAt: Date;
  } | null;
  modelInputs: ModelInputRow[];
  priceHistory: PricePoint[];
  orderbook: {
    yesBids: Array<{ priceCents: number; quantity: number }>;
    yesAsks: Array<{ priceCents: number; quantity: number }>;
  };
  expectedRoiBps: number | null;
  onWatchlist: boolean;
}

export async function loadMarketDetail(ticker: string): Promise<MarketDetail | null> {
  const market = await prisma.market.findUnique({
    where: { ticker },
    include: {
      estimates: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { inputs: true },
      },
      snapshots: {
        orderBy: { capturedAt: "asc" },
        take: 500,
      },
      watchlistItem: true,
    },
  });
  if (!market) return null;

  const estimates = await prisma.modelEstimate.findMany({
    where: { marketId: market.id },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: { createdAt: true, probability: true },
  });
  const estByMs = new Map<number, number | null>();
  for (const e of estimates) {
    estByMs.set(roundToMinute(e.createdAt), e.probability ?? null);
  }

  const priceHistory: PricePoint[] = market.snapshots.map((s) => {
    const impliedCents =
      s.yesBidCents != null && s.yesAskCents != null
        ? Math.round((s.yesBidCents + s.yesAskCents) / 2)
        : s.lastPriceCents ?? null;
    const modelProb = estByMs.get(roundToMinute(s.capturedAt)) ?? null;
    return {
      t: s.capturedAt.toISOString(),
      yes: impliedCents,
      model: modelProb == null ? null : Math.round(modelProb * 100),
    };
  });

  const latest = market.estimates[0];
  const modelInputs: ModelInputRow[] = latest
    ? latest.inputs.map((i) => ({
        source: i.source,
        key: i.key,
        value: safeJson(i.value),
        weight: i.weight,
        contribution: i.contribution,
        timestamp: i.timestamp.toISOString(),
        freshnessSec: i.freshnessSec,
      }))
    : [];

  let orderbook = { yesBids: [] as Array<{ priceCents: number; quantity: number }>, yesAsks: [] as Array<{ priceCents: number; quantity: number }> };
  try {
    const client = new KalshiClient();
    const book = await getOrderbook(client, market.ticker);
    orderbook = { yesBids: book.yesBids, yesAsks: book.yesAsks };
  } catch (err) {
    console.warn("[market-detail] orderbook failed", err);
  }

  const yesAsk = market.lastYesAskCents ?? null;
  const noAsk = market.lastNoAskCents ?? null;
  const marketProb = midImpliedProbability(market.lastYesBidCents, yesAsk, market.lastPriceCents);
  let expectedRoiBps: number | null = null;
  if (latest?.probability != null && marketProb != null) {
    const side: "yes" | "no" = latest.probability > marketProb ? "yes" : "no";
    const ask = side === "yes" ? yesAsk : noAsk ?? (yesAsk != null ? 100 - yesAsk : null);
    if (ask != null) {
      const roi = expectedROI(side, latest.probability, ask);
      expectedRoiBps = roi != null ? Math.round(roi * 10_000) : null;
    }
  }

  return {
    marketRow: market,
    latestEstimate: latest
      ? {
          id: latest.id,
          modelId: latest.modelId,
          modelVersion: latest.modelVersion,
          status: latest.status as "ok" | "insufficient_data" | "error",
          probability: latest.probability,
          confidence: latest.confidence,
          marketProbability: latest.marketProbability,
          diffPoints: latest.diffPoints,
          opportunityScore: latest.opportunityScore,
          explanation: latest.explanation,
          notes: latest.notes,
          createdAt: latest.createdAt,
        }
      : null,
    modelInputs,
    priceHistory,
    orderbook,
    expectedRoiBps,
    onWatchlist: Boolean(market.watchlistItem),
  };
}

function roundToMinute(d: Date): number {
  const t = d.getTime();
  return Math.floor(t / 60_000) * 60_000;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
