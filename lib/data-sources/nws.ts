// NOAA / National Weather Service adapter stub.
//
// Documented but not called in V1.  Real implementation lives behind
// `/points`, `/stations/{id}/observations/latest`, and `/gridpoints` endpoints
// per https://www.weather.gov/documentation/services-web-api.  Public, no key.

import type { DataSourceAdapter, DataSourceEnvelope } from "./types";

export interface NwsForecastParams {
  lat: number;
  lon: number;
}

export interface NwsForecast {
  period: string;
  temperatureF: number;
  probabilityOfPrecip: number | null;
}

export const nwsForecastAdapter: DataSourceAdapter<NwsForecastParams, NwsForecast[]> = {
  source: "nws",
  async fetch(_params): Promise<DataSourceEnvelope<NwsForecast[]>> {
    throw new Error("NWS adapter not implemented in V1 (Phase 5).");
  },
};
