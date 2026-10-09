import type { KalshiMarket } from "@/lib/kalshi/types";
import { insufficient, type ModelEstimate, type ProbabilityModel } from "./types";

export const ECONOMICS_MODEL_VERSION = "economics-v0.0.1";

export const economicsModel: ProbabilityModel = {
  id: "economics",
  name: "Economics (FRED/BLS/BEA, not yet wired)",
  version: ECONOMICS_MODEL_VERSION,

  supportsMarket(market: KalshiMarket): boolean {
    return /economics|CPI|unemployment|FOMC|GDP/i.test(
      `${market.category ?? ""} ${market.title}`,
    );
  },

  async estimate(_market: KalshiMarket): Promise<ModelEstimate> {
    return insufficient(
      ECONOMICS_MODEL_VERSION,
      "FRED/BLS/BEA adapters not implemented (Phase 5).",
    );
  },
};
