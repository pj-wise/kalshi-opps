// BLS (US Bureau of Labor Statistics) adapter stub.
//
// https://www.bls.gov/developers/api_signature_v2.htm
// Public API; a key raises per-day quota.

import type { DataSourceAdapter, DataSourceEnvelope } from "./types";

export interface BlsSeriesParams {
  seriesId: string;
  startyear?: string;
  endyear?: string;
}

export interface BlsObservation {
  year: string;
  period: string;
  value: number;
}

export const blsAdapter: DataSourceAdapter<BlsSeriesParams, BlsObservation[]> = {
  source: "bls",
  async fetch(_params): Promise<DataSourceEnvelope<BlsObservation[]>> {
    throw new Error("BLS adapter not implemented in V1 (Phase 5).");
  },
};
