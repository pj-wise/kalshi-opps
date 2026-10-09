import "server-only";

import { prisma } from "@/lib/prisma";
import { brierScore, logLoss } from "@/lib/math/probability";

export interface PerformanceReport {
  totalPredictions: number;
  resolvedPredictions: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgBrier: number | null;
  avgLogLoss: number | null;
  paperPnlCents: number;
  totalCostCents: number;
  roi: number | null;
  avgDiffPointsAtEntry: number | null;
  avgClosingMove: number | null;
  byCategory: Array<{ category: string; count: number; avgBrier: number | null; winRate: number | null; pnlCents: number }>;
  byConfidenceBucket: Array<{ bucket: string; count: number; avgBrier: number | null; winRate: number | null }>;
  byDiffBucket: Array<{ bucket: string; count: number; avgBrier: number | null; winRate: number | null }>;
  byMarketPriceBucket: Array<{ bucket: string; count: number; avgBrier: number | null; winRate: number | null }>;
  calibration: Array<{ bucket: string; predicted: number; observed: number | null; count: number }>;
  cumulativePnl: Array<{ t: string; cumulative: number }>;
}

export async function getPerformanceReport(): Promise<PerformanceReport> {
  const [totalPredictions, trades] = await Promise.all([
    prisma.modelEstimate.count({ where: { status: "ok" } }),
    prisma.paperTrade.findMany({
      where: { status: "resolved" },
      include: { market: true },
      orderBy: { resolvedAt: "asc" },
    }),
  ]);

  const resolvedPredictions = trades.length;
  const wins = trades.filter((t) => t.correct === true).length;
  const losses = trades.filter((t) => t.correct === false).length;
  const winRate = resolvedPredictions > 0 ? wins / resolvedPredictions : null;

  const brierSum = trades.reduce((acc, t) => {
    if (t.modelProbability == null || t.correct == null) return acc;
    return acc + brierScore(t.modelProbability, t.correct ? 1 : 0);
  }, 0);
  const logLossSum = trades.reduce((acc, t) => {
    if (t.modelProbability == null || t.correct == null) return acc;
    return acc + logLoss(t.modelProbability, t.correct ? 1 : 0);
  }, 0);
  const avgBrier = resolvedPredictions > 0 ? brierSum / resolvedPredictions : null;
  const avgLogLoss = resolvedPredictions > 0 ? logLossSum / resolvedPredictions : null;

  const paperPnlCents = trades.reduce((acc, t) => acc + (t.pnlCents ?? 0), 0);
  const totalCostCents = trades.reduce((acc, t) => acc + t.entryPriceCents * t.contracts, 0);
  const roi = totalCostCents > 0 ? paperPnlCents / totalCostCents : null;

  const diffPointsAtEntry = trades
    .map((t) =>
      t.modelProbability != null && t.marketProbability != null
        ? (t.modelProbability - t.marketProbability) * 100
        : null,
    )
    .filter((v): v is number => v != null);
  const avgDiffPointsAtEntry =
    diffPointsAtEntry.length > 0
      ? diffPointsAtEntry.reduce((a, b) => a + Math.abs(b), 0) / diffPointsAtEntry.length
      : null;

  const closingMoves = trades
    .map((t) => {
      if (t.closingPriceCents == null) return null;
      return t.closingPriceCents - t.entryPriceCents;
    })
    .filter((v): v is number => v != null);
  const avgClosingMove = closingMoves.length > 0 ? closingMoves.reduce((a, b) => a + b, 0) / closingMoves.length : null;

  // By category
  const byCategoryMap = new Map<string, { count: number; brierSum: number; wins: number; pnl: number }>();
  for (const t of trades) {
    const cat = t.market.category ?? "uncategorized";
    const entry = byCategoryMap.get(cat) ?? { count: 0, brierSum: 0, wins: 0, pnl: 0 };
    entry.count += 1;
    if (t.modelProbability != null && t.correct != null) {
      entry.brierSum += brierScore(t.modelProbability, t.correct ? 1 : 0);
    }
    if (t.correct) entry.wins += 1;
    entry.pnl += t.pnlCents ?? 0;
    byCategoryMap.set(cat, entry);
  }
  const byCategory = Array.from(byCategoryMap.entries()).map(([category, v]) => ({
    category,
    count: v.count,
    avgBrier: v.count > 0 ? v.brierSum / v.count : null,
    winRate: v.count > 0 ? v.wins / v.count : null,
    pnlCents: v.pnl,
  }));

  const byConfidenceBucket = bucketStat(trades, (t) => (t.confidence == null ? null : bucketLabel(t.confidence * 100, 20, "%")));
  const byDiffBucket = bucketStat(trades, (t) => {
    if (t.modelProbability == null || t.marketProbability == null) return null;
    const d = Math.abs(t.modelProbability - t.marketProbability) * 100;
    return bucketLabel(d, 5, "pts");
  });
  const byMarketPriceBucket = bucketStat(trades, (t) => bucketLabel(t.entryPriceCents, 10, "¢"));

  const calibration = buildCalibration(trades);

  const cumulativePnl: Array<{ t: string; cumulative: number }> = [];
  let running = 0;
  for (const t of trades) {
    if (!t.resolvedAt) continue;
    running += t.pnlCents ?? 0;
    cumulativePnl.push({ t: t.resolvedAt.toISOString(), cumulative: running });
  }

  return {
    totalPredictions,
    resolvedPredictions,
    wins,
    losses,
    winRate,
    avgBrier,
    avgLogLoss,
    paperPnlCents,
    totalCostCents,
    roi,
    avgDiffPointsAtEntry,
    avgClosingMove,
    byCategory,
    byConfidenceBucket,
    byDiffBucket,
    byMarketPriceBucket,
    calibration,
    cumulativePnl,
  };
}

function bucketStat<T extends { modelProbability: number | null; correct: boolean | null }>(
  trades: T[],
  classify: (t: T) => string | null,
): Array<{ bucket: string; count: number; avgBrier: number | null; winRate: number | null }> {
  const map = new Map<string, { count: number; brierSum: number; wins: number }>();
  for (const t of trades) {
    const label = classify(t);
    if (!label) continue;
    const entry = map.get(label) ?? { count: 0, brierSum: 0, wins: 0 };
    entry.count += 1;
    if (t.modelProbability != null && t.correct != null) {
      entry.brierSum += brierScore(t.modelProbability, t.correct ? 1 : 0);
    }
    if (t.correct) entry.wins += 1;
    map.set(label, entry);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, v]) => ({
      bucket,
      count: v.count,
      avgBrier: v.count > 0 ? v.brierSum / v.count : null,
      winRate: v.count > 0 ? v.wins / v.count : null,
    }));
}

function bucketLabel(value: number, step: number, unit: string): string {
  const lo = Math.floor(value / step) * step;
  return `${lo}-${lo + step}${unit}`;
}

function buildCalibration(trades: Array<{ modelProbability: number | null; correct: boolean | null }>) {
  const buckets: Array<{ bucket: string; predicted: number; observed: number | null; count: number }> = [];
  for (let i = 1; i < 10; i++) {
    const mid = i * 0.1;
    const bucketTrades = trades.filter(
      (t) =>
        t.modelProbability != null &&
        t.correct != null &&
        t.modelProbability >= mid - 0.05 &&
        t.modelProbability < mid + 0.05,
    );
    const count = bucketTrades.length;
    const observed = count > 0 ? bucketTrades.filter((t) => t.correct).length / count : null;
    buckets.push({
      bucket: `${(mid * 100).toFixed(0)}%`,
      predicted: mid,
      observed,
      count,
    });
  }
  return buckets;
}
