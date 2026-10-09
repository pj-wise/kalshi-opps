// Common probability-model interface.
//
// Every model is a pure object with:
//   - a stable `id` + `version` string (versioning is critical for audits)
//   - a cheap predicate `supportsMarket(market)`
//   - an async `estimate(market)` returning an `ModelEstimate` object
//
// A model MUST return `{ status: 'insufficient_data' }` if it does not have
// enough information to form a meaningful independent probability.  Never
// fabricate.

import type { KalshiMarket } from "@/lib/kalshi/types";

export type EstimateStatus = "ok" | "insufficient_data" | "error";

export interface ModelInput {
  source: string;
  key: string;
  // JSON-serializable scalar / object.
  value: unknown;
  weight: number;
  contribution?: number | null;
  timestamp: Date;
  freshnessSec?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface ModelEstimate {
  status: EstimateStatus;
  // 0-1 YES probability.  Only required when status === 'ok'.
  probability?: number;
  // 0-1 confidence.
  confidence?: number;
  explanation?: string;
  notes?: string;
  inputs: ModelInput[];
  modelVersion: string;
}

export interface ProbabilityModel {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  supportsMarket(market: KalshiMarket): boolean;
  estimate(market: KalshiMarket): Promise<ModelEstimate>;
}

export function insufficient(modelVersion: string, reason: string): ModelEstimate {
  return {
    status: "insufficient_data",
    inputs: [],
    modelVersion,
    explanation: reason,
  };
}
