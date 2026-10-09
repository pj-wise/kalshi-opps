// Prune old history so the SQLite file doesn't grow without bound.
//
// Every sync writes a snapshot, an estimate, and its model inputs for every
// market it scans (~500MB/day with auto-refresh running). We keep
// `historyRetentionDays` of that and delete the rest, except:
//   - each market's most recent estimate (the scanner shows it even if the
//     market hasn't been re-scanned lately)
//   - estimates referenced by a paper trade
//
// Deletes run in small batches so each write transaction is short and the
// dashboard's reads aren't held up while a prune is in progress.

import { prisma } from "@/lib/prisma";
import { readSettings } from "@/lib/settings";

const BATCH_SIZE = 5_000;
const MIN_INTERVAL_MS = 60 * 60 * 1000;

export interface PruneResult {
  cutoff: string;
  snapshotsDeleted: number;
  estimatesDeleted: number;
  inputsDeleted: number;
  opportunityRecordsDeleted: number;
}

let lastPrunedAt = 0;

/** Prune at most once per hour; cheap to call after every sync. */
export async function maybePruneHistory(): Promise<PruneResult | null> {
  if (Date.now() - lastPrunedAt < MIN_INTERVAL_MS) return null;
  lastPrunedAt = Date.now();
  const settings = await readSettings();
  return pruneHistory(settings.historyRetentionDays);
}

export async function pruneHistory(retentionDays: number): Promise<PruneResult> {
  // DateTime columns are stored as epoch milliseconds in SQLite.
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const snapshotsDeleted = await deleteInBatches(
    () => prisma.$executeRaw`
      DELETE FROM MarketSnapshot WHERE id IN (
        SELECT id FROM MarketSnapshot WHERE capturedAt < ${cutoffMs} LIMIT ${BATCH_SIZE}
      )
    `,
  );

  let estimatesDeleted = 0;
  let inputsDeleted = 0;
  for (;;) {
    const batch = await prisma.$queryRaw<{ id: string }[]>`
      SELECT e.id FROM ModelEstimate e
      WHERE e.createdAt < ${cutoffMs}
        AND EXISTS (
          SELECT 1 FROM ModelEstimate newer
          WHERE newer.marketId = e.marketId AND newer.createdAt > e.createdAt
        )
        AND NOT EXISTS (SELECT 1 FROM PaperTrade t WHERE t.estimateId = e.id)
      LIMIT ${BATCH_SIZE}
    `;
    if (batch.length === 0) break;
    const ids = batch.map((r) => r.id);
    const [inputs, estimates] = await prisma.$transaction([
      prisma.modelInput.deleteMany({ where: { estimateId: { in: ids } } }),
      prisma.modelEstimate.deleteMany({ where: { id: { in: ids } } }),
    ]);
    inputsDeleted += inputs.count;
    estimatesDeleted += estimates.count;
  }

  const opportunityRecordsDeleted = await deleteInBatches(
    () => prisma.$executeRaw`
      DELETE FROM DataSourceRecord WHERE id IN (
        SELECT id FROM DataSourceRecord
        WHERE source = 'opportunity_snapshot' AND retrievedAt < ${cutoffMs}
        LIMIT ${BATCH_SIZE}
      )
    `,
  );

  return {
    cutoff: new Date(cutoffMs).toISOString(),
    snapshotsDeleted,
    estimatesDeleted,
    inputsDeleted,
    opportunityRecordsDeleted,
  };
}

async function deleteInBatches(run: () => Promise<number>): Promise<number> {
  let total = 0;
  for (;;) {
    const n = await run();
    total += n;
    if (n < BATCH_SIZE) return total;
  }
}
