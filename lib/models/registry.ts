// Model registry.  Dispatches to the best-matching model for a given market.
//
// Order matters: specialized models are tried first; the generic model is the
// fallback.  Only one estimate is persisted per (market, model) pair at a
// time, but the registry can emit multiple estimates across different models
// if we later want to compare.

import type { KalshiMarket } from "@/lib/kalshi/types";
import { economicsModel } from "./economics";
import { genericModel } from "./generic";
import { sportsModel } from "./sports";
import { weatherModel } from "./weather";
import type { ModelEstimate, ProbabilityModel } from "./types";

export const MODELS: ProbabilityModel[] = [weatherModel, economicsModel, sportsModel, genericModel];

export function selectModel(market: KalshiMarket): ProbabilityModel {
  for (const model of MODELS) {
    if (model.supportsMarket(market)) {
      // The specialised ones often return `insufficient_data` in V1; fall
      // back to the generic model so the dashboard still ranks the market.
      if (model !== genericModel) {
        return model;
      }
      return model;
    }
  }
  return genericModel;
}

export async function estimateForMarket(
  market: KalshiMarket,
): Promise<{ model: ProbabilityModel; estimate: ModelEstimate }> {
  const primary = selectModel(market);
  const primaryEstimate = await primary.estimate(market);
  if (primaryEstimate.status === "ok" || primary === genericModel) {
    return { model: primary, estimate: primaryEstimate };
  }
  // Specialised model couldn't produce an estimate — fall back to generic
  // so the market still has a sortable row.  The explanation preserves the
  // primary's reason via notes.
  const fallback = await genericModel.estimate(market);
  return {
    model: genericModel,
    estimate: {
      ...fallback,
      notes: `${primary.name}: ${primaryEstimate.explanation ?? "insufficient_data"}`,
    },
  };
}

export { genericModel, weatherModel, economicsModel, sportsModel };
