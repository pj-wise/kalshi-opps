// Weather model skeleton.  No real NOAA/NWS plumbing in V1 — this file wires
// up the model registry so later work can swap `estimate` for a real NWS call.

import type { KalshiMarket } from "@/lib/kalshi/types";
import { insufficient, type ModelEstimate, type ProbabilityModel } from "./types";

export const WEATHER_MODEL_VERSION = "weather-v0.0.1";

export const weatherModel: ProbabilityModel = {
  id: "weather",
  name: "Weather (NOAA/NWS, not yet wired)",
  version: WEATHER_MODEL_VERSION,

  supportsMarket(market: KalshiMarket): boolean {
    return (market.category ?? "").toLowerCase() === "weather";
  },

  async estimate(_market: KalshiMarket): Promise<ModelEstimate> {
    return insufficient(
      WEATHER_MODEL_VERSION,
      "NOAA/NWS adapter not implemented (Phase 5).",
    );
  },
};
