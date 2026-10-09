import type { KalshiMarket } from "@/lib/kalshi/types";
import { insufficient, type ModelEstimate, type ProbabilityModel } from "./types";

export const SPORTS_MODEL_VERSION = "sports-v0.0.1";

export const sportsModel: ProbabilityModel = {
  id: "sports",
  name: "Sports (consensus adapter, not yet wired)",
  version: SPORTS_MODEL_VERSION,

  supportsMarket(market: KalshiMarket): boolean {
    return (market.category ?? "").toLowerCase() === "sports";
  },

  async estimate(_market: KalshiMarket): Promise<ModelEstimate> {
    return insufficient(
      SPORTS_MODEL_VERSION,
      "External sports-consensus adapter not implemented (Phase 5+).",
    );
  },
};
