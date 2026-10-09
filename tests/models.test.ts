import { describe, expect, test } from "vitest";

import { genericModel } from "@/lib/models/generic";
import { estimateForMarket } from "@/lib/models/registry";
import type { KalshiMarket } from "@/lib/kalshi/types";

function market(overrides: Partial<KalshiMarket> = {}): KalshiMarket {
  return {
    ticker: "T",
    eventTicker: null,
    seriesTicker: null,
    title: "A test",
    subtitle: null,
    category: "Weather",
    status: "active",
    yesSubTitle: null,
    noSubTitle: null,
    rulesPrimary: null,
    rulesSecondary: null,
    openTime: null,
    closeTime: null,
    expirationTime: null,
    settlementValue: null,
    settlementSource: null,
    yesBidCents: 40,
    yesAskCents: 44,
    noBidCents: 56,
    noAskCents: 60,
    lastPriceCents: 42,
    volume: 1000,
    volume24h: 100,
    openInterest: 500,
    liquidityCents: 50_000,
    providerMeta: null,
    ...overrides,
  };
}

describe("generic model", () => {
  test("returns insufficient when no prices are present", async () => {
    const est = await genericModel.estimate(market({ yesBidCents: null, yesAskCents: null, lastPriceCents: null }));
    expect(est.status).toBe("insufficient_data");
  });

  test("blends market mid with a matching category prior", async () => {
    const est = await genericModel.estimate(
      market({
        title: "Will the FOMC cut rates?",
        category: "Economics",
      }),
    );
    expect(est.status).toBe("ok");
    expect(est.probability).toBeGreaterThan(0.3);
    expect(est.probability).toBeLessThan(0.6);
    expect(est.confidence).toBeGreaterThan(0);
    // Generic model's confidence cap was raised to 0.5 so prior-matching +
    // decent liquidity can clear the alert threshold alongside structural tags.
    expect(est.confidence).toBeLessThanOrEqual(0.5);
  });

  test("falls back to market mid when nothing matches", async () => {
    const est = await genericModel.estimate(
      market({ title: "Random event", category: "Other" }),
    );
    expect(est.status).toBe("ok");
    expect(est.probability).toBeCloseTo(0.42, 1);
  });
});

describe("registry", () => {
  test("weather specialization returns insufficient data but registry falls back to generic", async () => {
    const { model, estimate } = await estimateForMarket(
      market({ title: "Will it rain?", category: "Weather" }),
    );
    expect(model.id).toBe("generic");
    expect(estimate.status).toBe("ok");
    expect(estimate.notes).toContain("Weather");
  });
});
