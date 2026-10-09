// Normalized Kalshi types that the rest of the app consumes.
// Keeping them separate from the raw Kalshi response shapes means we can
// swap sources (demo API, prod API, mock) without touching callers.

export type MarketStatus =
  | "unopened"
  | "active"
  | "closed"
  | "settled"
  | "determined";

export interface KalshiMarket {
  ticker: string;
  eventTicker: string | null;
  seriesTicker: string | null;
  title: string;
  subtitle: string | null;
  category: string | null;
  status: MarketStatus;
  yesSubTitle: string | null;
  noSubTitle: string | null;
  rulesPrimary: string | null;
  rulesSecondary: string | null;
  openTime: string | null;
  closeTime: string | null;
  expirationTime: string | null;
  settlementValue: number | null;
  settlementSource: string | null;
  yesBidCents: number | null;
  yesAskCents: number | null;
  noBidCents: number | null;
  noAskCents: number | null;
  lastPriceCents: number | null;
  volume: number;
  volume24h: number;
  openInterest: number;
  liquidityCents: number;
  providerMeta: Record<string, unknown> | null;
}

export interface KalshiOrderbookLevel {
  priceCents: number;
  quantity: number;
}

export interface KalshiOrderbook {
  ticker: string;
  yesBids: KalshiOrderbookLevel[];
  yesAsks: KalshiOrderbookLevel[];
  noBids: KalshiOrderbookLevel[];
  noAsks: KalshiOrderbookLevel[];
  capturedAt: string;
}

export interface KalshiTrade {
  ticker: string;
  side: "yes" | "no";
  priceCents: number;
  count: number;
  takerSide: "yes" | "no" | null;
  createdAt: string;
}

export interface KalshiEvent {
  eventTicker: string;
  seriesTicker: string | null;
  title: string;
  category: string | null;
  subTitle: string | null;
  mutuallyExclusive: boolean;
}

export interface MarketPage {
  markets: KalshiMarket[];
  cursor: string | null;
  /** Where the data came from this request. */
  source: "live" | "mock-forced" | "mock-fallback";
  /** If we fell back from live to mock, this holds the reason. */
  fallbackReason?: string;
}
