// App-level settings persisted in the AppSetting table.
// Keep schemas and defaults in one place so the UI, the sync layer, and the
// scoring code all read the same values.

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { DEFAULT_WEIGHTS, type OpportunityScoreWeights } from "./math/opportunity";

export const settingsSchema = z.object({
  // Scanner filters
  minProbabilityDiffPoints: z.number().min(0).max(100).default(5),
  minConfidence: z.number().min(0).max(1).default(0.2),
  minLiquidityCents: z.number().int().min(0).default(5_000),
  maxSpreadCents: z.number().int().min(0).default(10),

  // Paper trading / risk
  defaultBankrollCents: z.number().int().min(0).default(100_000),
  defaultKellyFraction: z.number().min(0).max(1).default(0.25),

  // Snapshots & alerts
  snapshotMinOpportunityScore: z.number().min(0).max(100).default(25),
  alertMinOpportunityScore: z.number().min(0).max(100).default(50),

  // Opportunity scoring weights (override DEFAULT_WEIGHTS)
  opportunityWeights: z.object({
    minProbDiff: z.number().min(0).max(1).default(DEFAULT_WEIGHTS.minProbDiff),
    liquiditySaturationCents: z.number().int().min(1).default(DEFAULT_WEIGHTS.liquiditySaturationCents),
    spreadPenaltyCents: z.number().int().min(1).default(DEFAULT_WEIGHTS.spreadPenaltyCents),
    idealSecondsToClose: z.number().int().min(1).default(DEFAULT_WEIGHTS.idealSecondsToClose),
    freshnessDecaySec: z.number().int().min(1).default(DEFAULT_WEIGHTS.freshnessDecaySec),
    confidenceFloor: z.number().min(0).max(1).default(DEFAULT_WEIGHTS.confidenceFloor),
  }).default({
    minProbDiff: DEFAULT_WEIGHTS.minProbDiff,
    liquiditySaturationCents: DEFAULT_WEIGHTS.liquiditySaturationCents,
    spreadPenaltyCents: DEFAULT_WEIGHTS.spreadPenaltyCents,
    idealSecondsToClose: DEFAULT_WEIGHTS.idealSecondsToClose,
    freshnessDecaySec: DEFAULT_WEIGHTS.freshnessDecaySec,
    confidenceFloor: DEFAULT_WEIGHTS.confidenceFloor,
  }),

  // Enabled models/categories
  enabledModels: z.array(z.string()).default(["generic", "weather", "economics", "sports"]),
  enabledCategories: z.array(z.string()).default([]),

  // Data refresh (seconds between background refetches when open)
  marketRefreshSec: z.number().int().min(30).default(180),
  modelRefreshSec: z.number().int().min(30).default(180),

  // Days of price/estimate history to keep (see lib/retention.ts)
  historyRetentionDays: z.number().int().min(1).default(3),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

const SETTINGS_KEY = "app";

export async function readSettings(): Promise<Settings> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(row.value);
    return settingsSchema.parse({ ...DEFAULT_SETTINGS, ...parsed });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function writeSettings(update: Partial<Settings>): Promise<Settings> {
  const current = await readSettings();
  const merged = settingsSchema.parse({ ...current, ...update });
  await prisma.appSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(merged) },
    update: { value: JSON.stringify(merged) },
  });
  return merged;
}

export function toOpportunityWeights(settings: Settings): OpportunityScoreWeights {
  return settings.opportunityWeights;
}
