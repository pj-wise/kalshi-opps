import { describe, expect, test } from "vitest";
import {
  classifyTier,
  computeMarketTags,
  computeOpportunityScore,
  DEFAULT_WEIGHTS,
} from "@/lib/math/opportunity";

describe("opportunity score", () => {
  test("structural axis still scores when model probability is missing", () => {
    const r = computeOpportunityScore({
      modelProbability: null,
      marketProbability: 0.5,
      confidence: 0.5,
      liquidityCents: 100_000,
      spreadCents: 2,
      secondsToClose: DEFAULT_WEIGHTS.idealSecondsToClose,
      dataAgeSec: 0,
    });
    expect(r.insufficient).toBe(true);
    expect(r.probDiffAxis).toBe(0);
    expect(r.structuralAxis).toBeGreaterThan(50);
    expect(r.score).toBeGreaterThan(10);
  });

  test("small probDiff still contributes something", () => {
    const r = computeOpportunityScore({
      modelProbability: 0.55,
      marketProbability: 0.5,
      confidence: 0.4,
      liquidityCents: 50_000,
      spreadCents: 3,
      secondsToClose: DEFAULT_WEIGHTS.idealSecondsToClose,
      dataAgeSec: 0,
    });
    expect(r.insufficient).toBe(false);
    expect(r.score).toBeGreaterThan(15);
  });

  test("below minProbDiff zeroes the gap axis but structural still contributes", () => {
    const r = computeOpportunityScore({
      modelProbability: 0.505,
      marketProbability: 0.5,
      confidence: 0.4,
      liquidityCents: 50_000,
      spreadCents: 3,
      secondsToClose: DEFAULT_WEIGHTS.idealSecondsToClose,
      dataAgeSec: 0,
    });
    expect(r.probDiffAxis).toBe(0);
    expect(r.structuralAxis).toBeGreaterThan(0);
  });

  test("strong inputs can clear the 50-point threshold", () => {
    const r = computeOpportunityScore({
      modelProbability: 0.7,
      marketProbability: 0.4,
      confidence: 0.6,
      liquidityCents: 150_000,
      spreadCents: 1,
      secondsToClose: DEFAULT_WEIGHTS.idealSecondsToClose,
      dataAgeSec: 0,
      calibrationScore: 0.6,
    });
    expect(r.score).toBeGreaterThanOrEqual(50);
  });

  test("wider spread lowers the structural axis", () => {
    const base = {
      modelProbability: 0.6,
      marketProbability: 0.4,
      confidence: 0.5,
      liquidityCents: 50_000,
      secondsToClose: DEFAULT_WEIGHTS.idealSecondsToClose,
      dataAgeSec: 0,
    };
    const narrow = computeOpportunityScore({ ...base, spreadCents: 1 });
    const wide = computeOpportunityScore({ ...base, spreadCents: 15 });
    expect(wide.structuralAxis).toBeLessThan(narrow.structuralAxis);
  });
});

describe("market tags", () => {
  test("wide spread + decent volume emits wide_spread_active", () => {
    const tags = computeMarketTags({
      yesBidCents: 40,
      yesAskCents: 48,
      spreadCents: 8,
      lastPriceCents: 44,
      volume24h: 100,
      liquidityCents: 10_000,
      secondsToClose: 60 * 60 * 24,
    });
    expect(tags.map((t) => t.tag)).toContain("wide_spread_active");
  });

  test("ask at 2¢ triggers tail_pricing", () => {
    const tags = computeMarketTags({
      yesBidCents: 1,
      yesAskCents: 2,
      spreadCents: 1,
      lastPriceCents: 2,
      volume24h: 5,
      liquidityCents: 2_000,
      secondsToClose: 60 * 60 * 24,
    });
    expect(tags.map((t) => t.tag)).toContain("tail_pricing");
  });

  test("50¢ with low volume emits uninformed_50", () => {
    const tags = computeMarketTags({
      yesBidCents: 49,
      yesAskCents: 51,
      spreadCents: 2,
      lastPriceCents: 50,
      volume24h: 3,
      liquidityCents: 2_000,
      secondsToClose: 60 * 60 * 24,
    });
    expect(tags.map((t) => t.tag)).toContain("uninformed_50");
  });
});

describe("tier classification", () => {
  const base = {
    alertThreshold: 50,
    snapshotThreshold: 25,
    minConfidence: 0.2,
  };

  test("edge requires score ≥ alert threshold AND confidence ≥ min", () => {
    expect(
      classifyTier({ ...base, score: 60, confidence: 0.3, tags: [] }),
    ).toBe("edge");
    expect(
      classifyTier({ ...base, score: 60, confidence: 0.1, tags: [] }),
    ).toBe("possible"); // falls through to possible on score alone
  });

  test("arb tag always promotes to possible", () => {
    expect(
      classifyTier({ ...base, score: 10, confidence: 0, tags: ["arb_sum_low"] }),
    ).toBe("possible");
  });

  test("one tag promotes to watch", () => {
    expect(
      classifyTier({
        ...base,
        score: 10,
        confidence: 0,
        tags: ["wide_spread_active"],
      }),
    ).toBe("watch");
  });

  test("two tags promote to possible", () => {
    expect(
      classifyTier({
        ...base,
        score: 10,
        confidence: 0,
        tags: ["wide_spread_active", "closing_soon_wide"],
      }),
    ).toBe("possible");
  });

  test("no signals returns none", () => {
    expect(classifyTier({ ...base, score: 5, confidence: 0, tags: [] })).toBe("none");
  });
});
