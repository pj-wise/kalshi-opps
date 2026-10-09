// Thin cache around the DataSourceRecord table.  Adapters use this to
// avoid hammering upstream APIs and to detect stale data.

import { prisma } from "@/lib/prisma";
import type { DataSourceEnvelope } from "./types";

export async function readCached<T>(
  source: string,
  key: string,
): Promise<DataSourceEnvelope<T> | null> {
  const row = await prisma.dataSourceRecord.findUnique({
    where: { source_key: { source, key } },
  });
  if (!row) return null;
  const value = JSON.parse(row.value) as T;
  const stale = row.expiresAt != null && row.expiresAt.getTime() < Date.now();
  return {
    source,
    key,
    value,
    retrievedAt: row.retrievedAt,
    expiresAt: row.expiresAt,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    stale,
  };
}

export async function writeCached<T>(
  envelope: DataSourceEnvelope<T>,
): Promise<void> {
  await prisma.dataSourceRecord.upsert({
    where: { source_key: { source: envelope.source, key: envelope.key } },
    create: {
      source: envelope.source,
      key: envelope.key,
      value: JSON.stringify(envelope.value),
      retrievedAt: envelope.retrievedAt,
      expiresAt: envelope.expiresAt,
      metadata: (envelope.metadata ?? undefined) as never,
    },
    update: {
      value: JSON.stringify(envelope.value),
      retrievedAt: envelope.retrievedAt,
      expiresAt: envelope.expiresAt,
      metadata: (envelope.metadata ?? undefined) as never,
    },
  });
}
