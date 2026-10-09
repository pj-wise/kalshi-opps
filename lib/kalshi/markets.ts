// Normalized market/orderbook accessors.
//
// The real Kalshi REST shapes are mapped into our internal types here.  If the
// client is in mock mode (either forced via KALSHI_MOCK_MODE or because the
// network call failed) we fall back to the deterministic mock dataset.

import { KalshiClient } from "./client";
import { pageMockMarkets, generateMockOrderbook, generateMockMarkets } from "./mock";
import type { KalshiMarket, KalshiOrderbook, MarketPage, MarketStatus } from "./types";

interface RawKalshiMarket {
  ticker: string;
  event_ticker?: string;
  series_ticker?: string;
  title?: string;
  subtitle?: string;
  category?: string;
  status?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  rules_primary?: string;
  rules_secondary?: string;
  open_time?: string;
  close_time?: string;
  expiration_time?: string;
  settlement_value?: number;
  settlement_source?: string;
  // Current Kalshi public API returns prices as dollar-formatted strings:
  //   yes_bid_dollars: "0.5500"  →  55¢
  // Keep the integer-cent fields around so the mock dataset (which uses the
  // older representation) still works unchanged.
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  last_price_dollars?: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  // Volume + liquidity: current API uses "_fp" suffixes with floating-point
  // strings; legacy mock uses plain numbers.
  volume_fp?: string;
  volume_24h_fp?: string;
  open_interest_fp?: string;
  yes_bid_size_fp?: string;
  yes_ask_size_fp?: string;
  volume?: number;
  volume_24h?: number;
  open_interest?: number;
  liquidity?: number;
}

interface RawMarketsResponse {
  markets?: RawKalshiMarket[];
  cursor?: string;
}

function dollarsToCents(value: string | number | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function parseFp(value: string | number | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStatus(status: string | undefined): MarketStatus {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return "active";
    case "unopened":
      return "unopened";
    case "closed":
      return "closed";
    case "settled":
    case "finalized":
      return "settled";
    case "determined":
      return "determined";
    default:
      return "active";
  }
}

function deriveSeriesTicker(raw: RawKalshiMarket): string | null {
  if (raw.series_ticker) return raw.series_ticker;
  // Kalshi tickers follow the pattern SERIES-EVENT-OUTCOME.  The event_ticker
  // is SERIES-EVENT.  So the series ticker is the first "-"-separated segment
  // of event_ticker.
  const et = raw.event_ticker ?? raw.ticker;
  if (!et) return null;
  const first = et.split("-")[0];
  return first || null;
}

function normalize(raw: RawKalshiMarket): KalshiMarket {
  const yesBid = dollarsToCents(raw.yes_bid_dollars) ?? raw.yes_bid ?? null;
  const yesAsk = dollarsToCents(raw.yes_ask_dollars) ?? raw.yes_ask ?? null;
  const noBid = dollarsToCents(raw.no_bid_dollars) ?? raw.no_bid ?? null;
  const noAsk = dollarsToCents(raw.no_ask_dollars) ?? raw.no_ask ?? null;
  const lastPrice = dollarsToCents(raw.last_price_dollars) ?? raw.last_price ?? null;
  const volume = Math.round(parseFp(raw.volume_fp) || raw.volume || 0);
  const volume24h = Math.round(parseFp(raw.volume_24h_fp) || raw.volume_24h || 0);
  const openInterest = Math.round(parseFp(raw.open_interest_fp) || raw.open_interest || 0);
  // Approximate liquidity (in cents) as open-interest × last-price.  Falls
  // back to the raw.liquidity field used by the mock dataset.
  const mid = lastPrice ?? (yesBid != null && yesAsk != null ? Math.round((yesBid + yesAsk) / 2) : null);
  const inferredLiquidity = mid != null && openInterest > 0 ? openInterest * mid : 0;
  const liquidityCents = raw.liquidity ?? inferredLiquidity;
  return {
    ticker: raw.ticker,
    eventTicker: raw.event_ticker ?? null,
    seriesTicker: deriveSeriesTicker(raw),
    title: raw.title ?? raw.ticker,
    subtitle: raw.subtitle ?? null,
    category: raw.category ?? null,
    status: toStatus(raw.status),
    yesSubTitle: raw.yes_sub_title ?? null,
    noSubTitle: raw.no_sub_title ?? null,
    rulesPrimary: raw.rules_primary ?? null,
    rulesSecondary: raw.rules_secondary ?? null,
    openTime: raw.open_time ?? null,
    closeTime: raw.close_time ?? null,
    expirationTime: raw.expiration_time ?? null,
    settlementValue: raw.settlement_value ?? null,
    settlementSource: raw.settlement_source ?? null,
    yesBidCents: yesBid,
    yesAskCents: yesAsk,
    noBidCents: noBid,
    noAskCents: noAsk,
    lastPriceCents: lastPrice,
    volume,
    volume24h,
    openInterest,
    liquidityCents,
    providerMeta: null,
  };
}

export interface ListMarketsParams {
  limit?: number;
  cursor?: string | null;
  status?: MarketStatus | "any";
  eventTicker?: string;
  seriesTicker?: string;
  category?: string;
  /** When true, follow Kalshi's event cursor until exhausted or `limit` reached. */
  paginate?: boolean;
}

interface RawEvent {
  event_ticker: string;
  series_ticker?: string;
  title?: string;
  sub_title?: string;
  category?: string;
  mutually_exclusive?: boolean;
  markets?: RawKalshiMarket[];
}

interface RawEventsResponse {
  events?: RawEvent[];
  cursor?: string;
}

// Kalshi's data model is Series → Event → Market.
//
// The /events endpoint has clean titles + categories but does NOT return
// prices on its nested markets.  The /markets endpoint has prices but the
// market `title` field is often mangled on multi-outcome events (it reads
// like a comma-separated list of sibling outcomes).
//
// So we do both:
//   1. Fetch /events to build an event_ticker → { title, category, series }
//      map (metadata only, no nested markets).
//   2. Fetch /markets paginated to get the actual prices.
//   3. Join: each market's display title becomes "<event title> · <outcome>",
//      with category/series inherited from the event when missing.
export interface EventMeta {
  title: string;
  category: string | null;
  seriesTicker: string | null;
  subTitle: string | null;
}

export async function listMarkets(
  client: KalshiClient,
  params: ListMarketsParams = {},
  eventMetaOverride?: Map<string, EventMeta>,
): Promise<MarketPage> {
  if (client.env.mockMode) {
    return pageMockMarkets(params.cursor ?? null, params.limit ?? 50, {
      source: "mock-forced",
    });
  }
  const marketCap = params.limit ?? 2000;
  try {
    // Reuse caller-provided event metadata when available so we don't blow
    // Kalshi's rate limit by refetching /events for each series.
    const eventMeta =
      eventMetaOverride ??
      (await loadEventMeta(client, {
        status: params.status,
        seriesTicker: params.seriesTicker,
        paginate: params.paginate ?? false,
      }));

    const markets: ReturnType<typeof normalize>[] = [];
    const seen = new Set<string>();
    let cursor: string | null | undefined = params.cursor ?? undefined;
    const perPage = 1000;
    for (let pageIndex = 0; pageIndex < 20; pageIndex++) {
      if (pageIndex > 0) await sleep(250);
      const data: RawMarketsResponse = await client.request<RawMarketsResponse>("/markets", {
        query: {
          limit: perPage,
          cursor: cursor ?? undefined,
          status: params.status && params.status !== "any" ? params.status : "open",
          series_ticker: params.seriesTicker,
        },
      });
      for (const raw of data.markets ?? []) {
        if (seen.has(raw.ticker)) continue;
        // Skip parlay bundles before they eat into the market cap.
        const series = deriveSeriesTicker(raw);
        if (series && EXCLUDED_SERIES.has(series)) {
          seen.add(raw.ticker);
          continue;
        }
        seen.add(raw.ticker);
        const meta = raw.event_ticker ? eventMeta.get(raw.event_ticker) : undefined;
        const outcome = raw.yes_sub_title ?? raw.subtitle;
        const base = meta?.title ?? raw.event_ticker ?? raw.ticker;
        const title =
          outcome && !base.toLowerCase().includes(outcome.toLowerCase())
            ? `${base} · ${outcome}`
            : base;
        markets.push(
          normalize({
            ...raw,
            title,
            category: raw.category ?? meta?.category ?? undefined,
            series_ticker: raw.series_ticker ?? meta?.seriesTicker ?? undefined,
            subtitle: raw.subtitle ?? meta?.subTitle ?? undefined,
          }),
        );
        if (markets.length >= marketCap) break;
      }
      cursor = data.cursor ?? null;
      if (!cursor || markets.length >= marketCap || !params.paginate) break;
    }
    return { markets, cursor: cursor ?? null, source: "live" };
  } catch (err) {
    const reason = (err as Error).message;
    console.warn("[kalshi] listMarkets failed, falling back to mock:", reason);
    return pageMockMarkets(params.cursor ?? null, params.limit ?? 50, {
      source: "mock-fallback",
      fallbackReason: reason,
    });
  }
}

/**
 * Fetch event metadata for a specific set of series tickers.  This is bounded
 * by the number of distinct series we care about (~50-100) rather than the
 * raw number of events (~thousands), so it fills in metadata that the general
 * paginated feed misses before hitting Kalshi's rate limit.
 */
export async function loadEventMetaForSeries(
  client: KalshiClient,
  seriesTickers: Iterable<string>,
  initial?: Map<string, EventMeta>,
): Promise<Map<string, EventMeta>> {
  const out = initial ?? new Map<string, EventMeta>();
  let delay = 0;
  for (const seriesTicker of seriesTickers) {
    if (!seriesTicker) continue;
    if (delay > 0) await sleep(delay);
    delay = 120;
    try {
      // Paginate within the series in case it has many events (unlikely for
      // weekly game series, but defensive).
      let cursor: string | null | undefined;
      for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
        const data: RawEventsResponse = await client.request<RawEventsResponse>("/events", {
          query: {
            limit: 200,
            cursor: cursor ?? undefined,
            series_ticker: seriesTicker,
          },
        });
        for (const ev of data.events ?? []) {
          if (!ev.event_ticker) continue;
          if (!out.has(ev.event_ticker)) {
            out.set(ev.event_ticker, {
              title: ev.title ?? ev.event_ticker,
              category: ev.category ?? null,
              seriesTicker: ev.series_ticker ?? seriesTicker,
              subTitle: ev.sub_title ?? null,
            });
          }
        }
        cursor = data.cursor ?? null;
        if (!cursor) break;
      }
    } catch (err) {
      console.warn(
        `[kalshi] loadEventMetaForSeries(${seriesTicker}) failed:`,
        (err as Error).message,
      );
    }
  }
  return out;
}

export async function loadEventMeta(
  client: KalshiClient,
  params: { status?: MarketStatus | "any"; seriesTicker?: string; paginate: boolean },
): Promise<Map<string, EventMeta>> {
  const out = new Map<string, EventMeta>();
  let cursor: string | null | undefined;
  for (let pageIndex = 0; pageIndex < 25; pageIndex++) {
    if (pageIndex > 0) await sleep(250);
    let data: RawEventsResponse;
    try {
      data = await client.request<RawEventsResponse>("/events", {
        query: {
          limit: 200,
          cursor: cursor ?? undefined,
          status: params.status && params.status !== "any" ? params.status : "open",
          series_ticker: params.seriesTicker,
        },
      });
    } catch (err) {
      // Partial-tolerant: if a later page fails (rate limit, transient), keep
      // whatever we've collected and move on so the sync still has usable
      // event metadata for most markets.
      console.warn(
        `[kalshi] loadEventMeta stopped early at page ${pageIndex}:`,
        (err as Error).message,
      );
      break;
    }
    for (const ev of data.events ?? []) {
      if (!ev.event_ticker) continue;
      out.set(ev.event_ticker, {
        title: ev.title ?? ev.event_ticker,
        category: ev.category ?? null,
        seriesTicker: ev.series_ticker ?? null,
        subTitle: ev.sub_title ?? null,
      });
    }
    cursor = data.cursor ?? null;
    if (!cursor || !params.paginate) break;
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Priority series to always sync explicitly on top of the general feed.
 * Kalshi's default event ordering buries weekly game lines behind long-horizon
 * markets, so we fetch these series by ticker to make sure they always land
 * in the DB regardless of where they appear in the general cursor stream.
 */
// Series we drop on the floor — Kalshi's multivariate "parlay" bundles
// combine unrelated outcomes and have mangled titles.
export const EXCLUDED_SERIES: ReadonlySet<string> = new Set([
  "KXMVECROSSCATEGORY",
  "KXMVECROSSCATEGORY0",
]);

export const PRIORITY_SERIES = [
  "KXNFLGAME",
  "KXNBAGAME",
  "KXMLBGAME",
  "KXNHLGAME",
  "KXWNBAGAME",
  "KXMLSGAME",
  "KXEPLGAME",
  "KXUFCGAME",
  "KXATP",
  "KXWTA",
] as const;

export async function listPrioritySeriesMarkets(
  client: KalshiClient,
  eventMeta?: Map<string, EventMeta>,
): Promise<MarketPage> {
  if (client.env.mockMode) {
    return pageMockMarkets(null, 0, { source: "mock-forced" });
  }
  const all: ReturnType<typeof normalize>[] = [];
  let source: MarketPage["source"] = "live";
  let fallbackReason: string | undefined;
  for (const seriesTicker of PRIORITY_SERIES) {
    try {
      const page = await listMarkets(
        client,
        { seriesTicker, limit: 400, paginate: true },
        eventMeta,
      );
      if (page.source !== "live") {
        source = page.source;
        fallbackReason = page.fallbackReason;
      }
      all.push(...page.markets);
      // Gentle throttle so we don't trip the rate limiter when iterating
      // across ~10 priority series back-to-back.
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.warn(`[kalshi] priority series ${seriesTicker} failed:`, (err as Error).message);
    }
  }
  return { markets: all, cursor: null, source, fallbackReason };
}

export async function getMarket(client: KalshiClient, ticker: string): Promise<KalshiMarket | null> {
  if (client.env.mockMode) {
    const all = generateMockMarkets();
    return all.find((m) => m.ticker === ticker) ?? null;
  }
  try {
    const data = await client.request<{ market?: RawKalshiMarket }>(
      `/markets/${encodeURIComponent(ticker)}`,
    );
    return data.market ? normalize(data.market) : null;
  } catch (err) {
    console.warn("[kalshi] getMarket failed, falling back to mock:", (err as Error).message);
    const all = generateMockMarkets();
    return all.find((m) => m.ticker === ticker) ?? null;
  }
}

interface RawOrderbookResponse {
  orderbook?: {
    yes?: Array<[number, number]>;
    no?: Array<[number, number]>;
  };
}

export async function getOrderbook(
  client: KalshiClient,
  ticker: string,
): Promise<KalshiOrderbook> {
  if (client.env.mockMode) {
    return generateMockOrderbook(ticker);
  }
  try {
    const data = await client.request<RawOrderbookResponse>(
      `/markets/${encodeURIComponent(ticker)}/orderbook`,
    );
    const yes = data.orderbook?.yes ?? [];
    const no = data.orderbook?.no ?? [];
    // Kalshi returns [price, size] pairs sorted by price ascending.
    const yesBids = yes.map(([p, q]) => ({ priceCents: p, quantity: q })).sort((a, b) => b.priceCents - a.priceCents);
    const yesAsks = yes.map(([p, q]) => ({ priceCents: 100 - p, quantity: q })).sort((a, b) => a.priceCents - b.priceCents);
    const noBids = no.map(([p, q]) => ({ priceCents: p, quantity: q })).sort((a, b) => b.priceCents - a.priceCents);
    const noAsks = no.map(([p, q]) => ({ priceCents: 100 - p, quantity: q })).sort((a, b) => a.priceCents - b.priceCents);
    return {
      ticker,
      yesBids,
      yesAsks,
      noBids,
      noAsks,
      capturedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[kalshi] getOrderbook failed, falling back to mock:", (err as Error).message);
    return generateMockOrderbook(ticker);
  }
}
