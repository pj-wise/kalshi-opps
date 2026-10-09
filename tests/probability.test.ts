import { describe, expect, test } from "vitest";

import {
  brierScore,
  centsToProbability,
  expectedROI,
  expectedValueCentsPerContract,
  fullKellyFraction,
  kellyStakeCents,
  logLoss,
  midImpliedProbability,
  paperTradePnl,
  probabilityToCents,
  spreadCents,
} from "@/lib/math/probability";

describe("probability conversions", () => {
  test("roundtrips cents <-> probability", () => {
    for (let c = 0; c <= 100; c++) {
      expect(centsToProbability(c)).toBeCloseTo(c / 100, 10);
      expect(probabilityToCents(c / 100)).toBe(c);
    }
  });

  test("clamps out-of-range inputs", () => {
    expect(centsToProbability(-10)).toBe(0);
    expect(centsToProbability(300)).toBe(1);
    expect(probabilityToCents(-1)).toBe(0);
    expect(probabilityToCents(2)).toBe(100);
  });
});

describe("midImpliedProbability", () => {
  test("uses the mid when both bid/ask present", () => {
    expect(midImpliedProbability(40, 44, null)).toBeCloseTo(0.42);
  });
  test("falls back to last price", () => {
    expect(midImpliedProbability(null, null, 60)).toBeCloseTo(0.6);
  });
  test("returns null when nothing is known", () => {
    expect(midImpliedProbability(null, null, null)).toBeNull();
  });
});

describe("spreadCents", () => {
  test("difference of ask and bid", () => {
    expect(spreadCents(40, 44)).toBe(4);
  });
  test("null when either side missing", () => {
    expect(spreadCents(null, 44)).toBeNull();
    expect(spreadCents(40, null)).toBeNull();
  });
  test("floors at 0 when crossed", () => {
    expect(spreadCents(50, 45)).toBe(0);
  });
});

describe("expected value", () => {
  test("YES at ask=50¢ with model=60% nets +10¢ EV per contract", () => {
    expect(expectedValueCentsPerContract("yes", 0.6, 50)).toBeCloseTo(10);
  });
  test("NO at ask=50¢ with model=60% nets -10¢ EV per contract", () => {
    expect(expectedValueCentsPerContract("no", 0.6, 50)).toBeCloseTo(-10);
  });
  test("expectedROI reflects EV ÷ ask", () => {
    expect(expectedROI("yes", 0.6, 50)).toBeCloseTo(0.2);
    expect(expectedROI("no", 0.4, 50)).toBeCloseTo(0.2);
  });
});

describe("Brier and log loss", () => {
  test("perfect prediction has 0 Brier and 0 log loss", () => {
    expect(brierScore(1, 1)).toBe(0);
    expect(brierScore(0, 0)).toBe(0);
    expect(logLoss(1, 1)).toBeCloseTo(0, 5);
  });
  test("worst prediction has 1 Brier", () => {
    expect(brierScore(0, 1)).toBe(1);
  });
  test("midpoint prediction gives 0.25 Brier and ln2 log loss", () => {
    expect(brierScore(0.5, 1)).toBeCloseTo(0.25);
    expect(logLoss(0.5, 1)).toBeCloseTo(Math.log(2), 5);
  });
});

describe("Kelly", () => {
  test("non-positive edge yields 0", () => {
    expect(fullKellyFraction("yes", 0.5, 50)).toBe(0);
    expect(fullKellyFraction("yes", 0.3, 50)).toBe(0);
  });
  test("edge yields positive Kelly fraction", () => {
    const f = fullKellyFraction("yes", 0.6, 50);
    // b = 1, p = 0.6, q = 0.4 → f* = 0.2
    expect(f).toBeCloseTo(0.2);
  });
  test("fractional Kelly scales stake", () => {
    const stake = kellyStakeCents("yes", 0.6, 50, 100_00, 0.25);
    // full Kelly $20, 1/4 is $5
    expect(stake).toBe(500);
  });
});

describe("paper trade P&L", () => {
  test("winning YES at 40¢ pays 60¢ per contract", () => {
    const r = paperTradePnl("yes", 40, 10, "yes");
    expect(r.pnlCents).toBe(600);
    expect(r.roi).toBeCloseTo(600 / 400);
    expect(r.correct).toBe(true);
  });
  test("losing NO at 40¢ loses 40¢ per contract", () => {
    const r = paperTradePnl("no", 40, 10, "yes");
    expect(r.pnlCents).toBe(-400);
    expect(r.correct).toBe(false);
  });
  test("void returns the cost", () => {
    const r = paperTradePnl("yes", 40, 10, "void");
    expect(r.pnlCents).toBe(0);
    expect(r.resolvedValueCents).toBe(400);
    expect(r.correct).toBeNull();
  });
});
