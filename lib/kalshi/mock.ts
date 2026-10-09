// Deterministic mock data generator.
//
// Produces a stable, realistic-ish list of Kalshi-shaped markets so the entire
// dashboard works end-to-end without credentials.  Determinism keeps snapshots
// reproducible between dev runs.

import type { KalshiMarket, KalshiOrderbook, MarketPage, MarketStatus } from "./types";

// Simple PRNG so we don't need a dependency.
function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

const TEMPLATES: Array<{
  ticker: string;
  title: string;
  subtitle: string;
  category: string;
  rulesPrimary: string;
  closeInHours: number;
  bias: number; // 0-1, where the "true" probability sits
}> = [
  // ─── Economics ─────────────────────────────────────────────────────────────
  {
    ticker: "KXFEDDECISION-26DEC-25",
    title: "Will the Fed cut interest rates in December?",
    subtitle: "By 0.25% (25 basis points)",
    category: "Economics",
    rulesPrimary:
      "Settles YES if the Federal Reserve announces a 0.25% rate cut at its December 2026 meeting.",
    closeInHours: 24 * 20,
    bias: 0.42,
  },
  {
    ticker: "KXCPIYY-26OCT-32",
    title: "Will US inflation stay above 3.2% in October?",
    subtitle: "Headline CPI, year-over-year",
    category: "Economics",
    rulesPrimary:
      "Settles YES if the government's first reading of October 2026 headline inflation (CPI year-over-year) is above 3.2%.",
    closeInHours: 24 * 9,
    bias: 0.58,
  },
  {
    ticker: "KXUNRATE-26OCT-4",
    title: "Will US unemployment rise above 4.3% in October?",
    subtitle: "Monthly jobs report",
    category: "Economics",
    rulesPrimary:
      "Settles YES if the government's first October 2026 unemployment rate is above 4.3%.",
    closeInHours: 24 * 11,
    bias: 0.37,
  },

  // ─── Weather ───────────────────────────────────────────────────────────────
  {
    ticker: "KXNYCHIGH-26OCT05",
    title: "Will NYC hit 72°F or warmer on Oct 5?",
    subtitle: "High temperature in Central Park",
    category: "Weather",
    rulesPrimary:
      "Settles YES if Central Park's observed daily high on Oct 5, 2026 reaches 72°F.",
    closeInHours: 36,
    bias: 0.63,
  },
  {
    ticker: "KXSFCHIGH-26OCT05",
    title: "Will San Francisco hit 75°F on Oct 5?",
    subtitle: "High temperature at SFO",
    category: "Weather",
    rulesPrimary:
      "Settles YES if the daily high at San Francisco International Airport on Oct 5, 2026 reaches 75°F.",
    closeInHours: 36,
    bias: 0.21,
  },
  {
    ticker: "KXHURRICANE-26-NOV",
    title: "Will a named Atlantic hurricane form in November?",
    subtitle: "National Hurricane Center declaration",
    category: "Weather",
    rulesPrimary:
      "Settles YES if the National Hurricane Center names a hurricane in the Atlantic during November 2026.",
    closeInHours: 24 * 27,
    bias: 0.44,
  },

  // ─── Sports — NFL ──────────────────────────────────────────────────────────
  {
    ticker: "KXNFL-26W6-CHIBAL",
    title: "Will the Bears beat the Ravens on Sunday?",
    subtitle: "NFL Week 6 · CHI @ BAL",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the Chicago Bears win the Week 6 game vs the Baltimore Ravens outright (any score, including overtime).",
    closeInHours: 48,
    bias: 0.28,
  },
  {
    ticker: "KXNFL-26W6-SFSEA",
    title: "Will the 49ers beat the Seahawks on Sunday?",
    subtitle: "NFL Week 6 · SF @ SEA",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the San Francisco 49ers win the Week 6 game vs the Seattle Seahawks outright.",
    closeInHours: 48,
    bias: 0.57,
  },
  {
    ticker: "KXNFL-26W6-DALGB",
    title: "Will the Cowboys beat the Packers on Sunday night?",
    subtitle: "NFL Week 6 · DAL @ GB · SNF",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the Dallas Cowboys win the Week 6 Sunday Night Football game vs the Green Bay Packers outright.",
    closeInHours: 60,
    bias: 0.46,
  },
  {
    ticker: "KXNFLCHAMP-26-KC",
    title: "Will the Chiefs win the AFC championship this season?",
    subtitle: "2026-27 NFL season",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the Kansas City Chiefs win the AFC Championship Game for the 2026-27 season.",
    closeInHours: 24 * 90,
    bias: 0.31,
  },
  {
    ticker: "KXNFLCHAMP-26-SF",
    title: "Will the 49ers win the NFC championship this season?",
    subtitle: "2026-27 NFL season",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the San Francisco 49ers win the NFC Championship Game for the 2026-27 season.",
    closeInHours: 24 * 90,
    bias: 0.24,
  },
  {
    ticker: "KXSB-26-AFC",
    title: "Will an AFC team win the Super Bowl this season?",
    subtitle: "Super Bowl LXI winner conference",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the AFC champion wins Super Bowl LXI.",
    closeInHours: 24 * 110,
    bias: 0.52,
  },

  // ─── Sports — MLB ──────────────────────────────────────────────────────────
  {
    ticker: "KXMLB-26NLCS-G5",
    title: "Will the Dodgers win Game 5 of the NLCS?",
    subtitle: "NLCS Game 5 at Dodger Stadium",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the Los Angeles Dodgers win Game 5 of the 2026 NLCS outright.",
    closeInHours: 24,
    bias: 0.56,
  },
  {
    ticker: "KXMLB-26ALCS-G5",
    title: "Will the Yankees win Game 5 of the ALCS?",
    subtitle: "ALCS Game 5 in New York",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the New York Yankees win Game 5 of the 2026 ALCS outright.",
    closeInHours: 24,
    bias: 0.48,
  },
  {
    ticker: "KXMLBWS-26-LAD",
    title: "Will the Dodgers win the World Series?",
    subtitle: "2026 MLB postseason",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the Los Angeles Dodgers win the 2026 World Series.",
    closeInHours: 24 * 14,
    bias: 0.22,
  },
  {
    ticker: "KXMLBWS-26-NYY",
    title: "Will the Yankees win the World Series?",
    subtitle: "2026 MLB postseason",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the New York Yankees win the 2026 World Series.",
    closeInHours: 24 * 14,
    bias: 0.14,
  },

  // ─── Sports — NBA ──────────────────────────────────────────────────────────
  {
    ticker: "KXNBA-26-TNT-BOSOKC",
    title: "Will the Celtics beat the Thunder tonight?",
    subtitle: "NBA regular season · BOS @ OKC",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the Boston Celtics win their regular-season game vs the Oklahoma City Thunder tonight.",
    closeInHours: 6,
    bias: 0.42,
  },
  {
    ticker: "KXNBA-26-LAL",
    title: "Will the Lakers make the NBA playoffs?",
    subtitle: "2026-27 NBA season",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the Los Angeles Lakers qualify for the 2026-27 NBA playoffs (including Play-In).",
    closeInHours: 24 * 170,
    bias: 0.63,
  },
  {
    ticker: "KXNBACHAMP-26-BOS",
    title: "Will the Celtics win the NBA championship?",
    subtitle: "2026-27 NBA season",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the Boston Celtics win the 2026-27 NBA Finals.",
    closeInHours: 24 * 240,
    bias: 0.11,
  },

  // ─── Sports — NHL ──────────────────────────────────────────────────────────
  {
    ticker: "KXNHL-26-EDMFLA",
    title: "Will the Oilers beat the Panthers tonight?",
    subtitle: "NHL regular season · EDM @ FLA",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the Edmonton Oilers win tonight's game vs the Florida Panthers in regulation, OT, or shootout.",
    closeInHours: 10,
    bias: 0.44,
  },
  {
    ticker: "KXNHLCUP-26-EDM",
    title: "Will the Oilers win the Stanley Cup?",
    subtitle: "2026-27 NHL season",
    category: "Sports",
    rulesPrimary: "Settles YES if the Edmonton Oilers win the 2026-27 Stanley Cup Final.",
    closeInHours: 24 * 220,
    bias: 0.16,
  },

  // ─── Sports — Soccer ───────────────────────────────────────────────────────
  {
    ticker: "KXEPL-26MC-LIV",
    title: "Will Manchester City beat Liverpool this weekend?",
    subtitle: "Premier League · MCI vs LIV",
    category: "Sports",
    rulesPrimary:
      "Settles YES if Manchester City win their Premier League match vs Liverpool in regulation time (90 min + stoppage).",
    closeInHours: 72,
    bias: 0.43,
  },
  {
    ticker: "KXUCL-26-MAD",
    title: "Will Real Madrid win the Champions League?",
    subtitle: "UEFA Champions League 2026-27",
    category: "Sports",
    rulesPrimary:
      "Settles YES if Real Madrid win the 2026-27 UEFA Champions League final.",
    closeInHours: 24 * 210,
    bias: 0.19,
  },

  // ─── Sports — Tennis / UFC ─────────────────────────────────────────────────
  {
    ticker: "KXATP-26FINALS-SIN",
    title: "Will Jannik Sinner win the ATP Finals?",
    subtitle: "Nitto ATP Finals, Turin",
    category: "Sports",
    rulesPrimary:
      "Settles YES if Jannik Sinner wins the 2026 Nitto ATP Finals singles title.",
    closeInHours: 24 * 25,
    bias: 0.34,
  },
  {
    ticker: "KXUFC-26-MAIN",
    title: "Will the favorite win Saturday's UFC main event?",
    subtitle: "UFC main card headliner",
    category: "Sports",
    rulesPrimary:
      "Settles YES if the betting favorite (per the host sportsbook consensus) wins Saturday's UFC main event by any method.",
    closeInHours: 60,
    bias: 0.58,
  },

  // ─── Crypto / Finance ──────────────────────────────────────────────────────
  {
    ticker: "KXBTC-26NOV1-100K",
    title: "Will Bitcoin close above $100,000 on Nov 1?",
    subtitle: "Coinbase daily close",
    category: "Crypto",
    rulesPrimary:
      "Settles YES if the Coinbase BTC-USD daily close on Nov 1, 2026 is above $100,000.",
    closeInHours: 24 * 27,
    bias: 0.55,
  },
  {
    ticker: "KXETH-26NOV1-4K",
    title: "Will Ethereum close above $4,000 on Nov 1?",
    subtitle: "Coinbase daily close",
    category: "Crypto",
    rulesPrimary:
      "Settles YES if the Coinbase ETH-USD daily close on Nov 1, 2026 is above $4,000.",
    closeInHours: 24 * 27,
    bias: 0.47,
  },
  {
    ticker: "KXSPX-26NOV1-5500",
    title: "Will the S&P 500 close above 5,500 on Nov 1?",
    subtitle: "S&P 500 daily close",
    category: "Finance",
    rulesPrimary:
      "Settles YES if the official S&P 500 close on the first US trading day on or after Nov 1, 2026 is above 5,500.",
    closeInHours: 24 * 27,
    bias: 0.68,
  },
  {
    ticker: "KXOIL-26NOV1-85",
    title: "Will US oil close above $85 on Nov 1?",
    subtitle: "WTI crude front-month settlement",
    category: "Finance",
    rulesPrimary:
      "Settles YES if the front-month WTI crude settlement price on the first trading day on or after Nov 1, 2026 is above $85.",
    closeInHours: 24 * 27,
    bias: 0.34,
  },

  // ─── Politics ──────────────────────────────────────────────────────────────
  {
    ticker: "KXELECGA-26-GOV",
    title: "Will the Democrat win the 2026 Georgia governor race?",
    subtitle: "Georgia gubernatorial election",
    category: "Politics",
    rulesPrimary:
      "Settles YES if the Democratic nominee wins the November 2026 Georgia gubernatorial election.",
    closeInHours: 24 * 32,
    bias: 0.48,
  },
];

function priceCents(trueProb: number, noise: number): { bid: number; ask: number; mid: number } {
  // Introduce a small market mispricing + spread.
  const biased = Math.max(0.03, Math.min(0.97, trueProb + (noise - 0.5) * 0.18));
  const spread = Math.max(1, Math.round(2 + noise * 5));
  const mid = Math.round(biased * 100);
  return {
    bid: Math.max(1, mid - Math.ceil(spread / 2)),
    ask: Math.min(99, mid + Math.floor(spread / 2)),
    mid,
  };
}

export function generateMockMarkets(now: Date = new Date()): KalshiMarket[] {
  // Use a stable seed per calendar day so the dataset doesn't thrash between
  // page loads within the same session.
  const dayKey = now.toISOString().slice(0, 10);
  const base = hashString(dayKey);
  return TEMPLATES.map((t, i) => {
    const rand = mulberry32(base + i * 7919);
    const noise = rand();
    const { bid, ask, mid } = priceCents(t.bias, noise);
    const closeMs = now.getTime() + t.closeInHours * 3600 * 1000;
    const status: MarketStatus = t.closeInHours < 0 ? "closed" : "active";
    const openInterest = Math.round(2_000 + rand() * 40_000);
    return {
      ticker: t.ticker,
      eventTicker: t.ticker.split("-").slice(0, 2).join("-"),
      seriesTicker: t.ticker.split("-")[0],
      title: t.title,
      subtitle: t.subtitle,
      category: t.category,
      status,
      yesSubTitle: "Yes",
      noSubTitle: "No",
      rulesPrimary: t.rulesPrimary,
      rulesSecondary: null,
      openTime: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      closeTime: new Date(closeMs).toISOString(),
      expirationTime: new Date(closeMs + 1000 * 60 * 60).toISOString(),
      settlementValue: null,
      settlementSource: null,
      yesBidCents: bid,
      yesAskCents: ask,
      noBidCents: 100 - ask,
      noAskCents: 100 - bid,
      lastPriceCents: mid,
      volume: Math.round(500 + rand() * 50_000),
      volume24h: Math.round(50 + rand() * 5_000),
      openInterest,
      liquidityCents: Math.round(openInterest * mid * 0.6),
      providerMeta: { source: "mock", trueBias: t.bias },
    };
  });
}

export function generateMockOrderbook(ticker: string, now: Date = new Date()): KalshiOrderbook {
  const rand = mulberry32(hashString(ticker + now.toISOString().slice(0, 10)));
  const yesBids: { priceCents: number; quantity: number }[] = [];
  const yesAsks: { priceCents: number; quantity: number }[] = [];
  const mid = 20 + Math.floor(rand() * 60);
  for (let i = 0; i < 5; i++) {
    yesBids.push({ priceCents: Math.max(1, mid - 1 - i), quantity: 50 + Math.floor(rand() * 400) });
    yesAsks.push({ priceCents: Math.min(99, mid + 1 + i), quantity: 50 + Math.floor(rand() * 400) });
  }
  return {
    ticker,
    yesBids,
    yesAsks,
    noBids: yesAsks.map((l) => ({ priceCents: 100 - l.priceCents, quantity: l.quantity })),
    noAsks: yesBids.map((l) => ({ priceCents: 100 - l.priceCents, quantity: l.quantity })),
    capturedAt: now.toISOString(),
  };
}

export function pageMockMarkets(
  cursor: string | null,
  pageSize: number,
  options: { now?: Date; source?: "mock-forced" | "mock-fallback"; fallbackReason?: string } = {},
): MarketPage {
  const now = options.now ?? new Date();
  const all = generateMockMarkets(now);
  const offset = cursor ? Number(cursor) || 0 : 0;
  const slice = all.slice(offset, offset + pageSize);
  const next = offset + pageSize < all.length ? String(offset + pageSize) : null;
  return {
    markets: slice,
    cursor: next,
    source: options.source ?? "mock-forced",
    fallbackReason: options.fallbackReason,
  };
}
