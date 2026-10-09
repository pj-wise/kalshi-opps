// FRED (Federal Reserve Economic Data) adapter stub.
//
// https://fred.stlouisfed.org/docs/api/fred/
// Free key: `FRED_API_KEY`.  Hourly request budget is generous but adapters
// should cache aggressively via `lib/data-sources/cache.ts`.

import type { DataSourceAdapter, DataSourceEnvelope } from "./types";

export interface FredSeriesParams {
  seriesId: string;
}

export interface FredObservation {
  date: string;
  value: number;
}

export const fredAdapter: DataSourceAdapter<FredSeriesParams, FredObservation[]> = {
  source: "fred",
  async fetch(_params): Promise<DataSourceEnvelope<FredObservation[]>> {
    throw new Error("FRED adapter not implemented in V1 (Phase 5).");
  },
};
