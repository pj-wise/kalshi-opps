# betgg — personal prediction-market analytics terminal

A local-only Next.js dashboard for analyzing Kalshi markets, estimating fair probabilities, logging paper trades, and tracking whether the model actually has a measurable predictive edge over time.

Not a SaaS product.  Not a trading platform.  Everything runs on your laptop against a local SQLite file.

## Core principles

1. **Never fabricate probabilities.**  If a model lacks real signal, it returns `status: "insufficient_data"`.  The scanner surfaces that honestly rather than inventing an "edge."
2. **Separate market probability, model probability, raw diff, EV-after-costs, confidence, liquidity, spread, time, and data freshness.**  A big gap is not an "edge" — it's one factor among many that the opportunity score blends transparently.
3. **Everything is auditable.**  Every model estimate stores the model's version string, every input it looked at, every input's value, timestamp, weight, and contribution.  Old estimates stay tied to the exact model version that produced them.
4. **No live-money trading in V1.**  The bot architecture exists so you can later wire it up, but the live path is hard-gated behind both an env flag and a calibration threshold — and even then V1 does not actually place real orders.
5. **Pure math is pure.**  Probability conversions, EV, spread, Brier, log loss, Kelly, and P&L are implemented as pure TypeScript with unit tests under `tests/`.

## Quick start

```bash
cp .env.example .env       # defaults are fine for local use
npm install                # runs `prisma generate` as a postinstall step
npm run db:migrate         # applies the schema to prisma/dev.db
npm run db:seed            # populates ~12 mock markets so the UI isn't empty
npm run dev                # http://localhost:3000
```

The first visit to `/` triggers a sync automatically if the DB is empty.  Subsequent syncs run on an interval configurable from `/settings` (`marketRefreshSec`).  You can also force a refresh with the button in the top bar or by `POST /api/refresh`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest suite (29 tests across probability, opportunity scoring, generic model) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Apply pending migrations (dev) |
| `npm run db:studio` | Prisma Studio for inspecting the DB |
| `npm run db:seed` | Pull one mock-market sync into the DB |

## Environment variables

See `.env.example` for the full list.  Highlights:

- `DATABASE_URL` — SQLite file, resolved relative to `prisma/schema.prisma`.
- `KALSHI_API_BASE` — Prod: `https://api.elections.kalshi.com/trade-api/v2`.  Trading demo: `https://demo-api.kalshi.co/trade-api/v2`.
- `KALSHI_MOCK_MODE` — set to `1` to force the deterministic mock dataset.  **This is the default** so the app works end-to-end before you register with Kalshi.
- `KALSHI_KEY_ID`, `KALSHI_PRIVATE_KEY_PATH` — Kalshi API-key signing credentials (see Kalshi docs).  V1 does **not** implement the signer; authenticated requests throw.
- `KALSHI_LIVE_TRADING_ENABLED` — see "Automated trading" below.
- `NWS_USER_AGENT`, `FRED_API_KEY`, `BLS_API_KEY` — placeholders for Phase 5 external-data adapters.

Credentials never reach the browser.  Everything that touches Kalshi runs in server code (Route Handlers, Server Components, or `scripts/`).

## Architecture

```
app/                        Next.js App Router pages + Route Handlers
components/
  ui/                       shadcn-style primitives (Button, Card, Dialog, Select, Table, Tabs…)
  scanner/                  summary cards, scanner table, refresh button
  market/                   analysis card, price-history chart, order book, paper-trade dialog, Kelly table
  performance/              calibration + cumulative P&L charts
  settings/                 settings form
lib/
  prisma.ts                 Singleton Prisma client
  settings.ts               AppSetting-backed settings with Zod schema + defaults
  sync.ts                   Pull markets → upsert → snapshot → run model → score → persist estimate
  queries.ts                Server-side read helpers used by pages
  format.ts                 Formatting helpers
  math/
    probability.ts          cents↔p, EV, spread, Brier, log loss, Kelly, paper-trade P&L
    opportunity.ts          computeOpportunityScore with per-component breakdown
  kalshi/                   Isolated Kalshi integration layer (client, env, markets, mock, types, websocket)
  models/                   Probability-model registry (generic, weather, economics, sports)
  data-sources/             Normalized adapter interface + cache (nws, fred, bls)
  bot/strategy.ts           Paper-only automated bot
  resolutions.ts            Market settlement handling → updates open paper trades
prisma/
  schema.prisma             Full data model
  migrations/               Prisma migrations
  dev.db                    SQLite file (gitignored)
scripts/
  seed.ts                   One-off sync for local setup
tests/                      Vitest unit tests
```

### Data model

| Table | Purpose |
| --- | --- |
| `Market` | Canonical market info; one row per Kalshi ticker |
| `MarketSnapshot` | Append-only price/liquidity history per market |
| `ModelEstimate` | Append-only; one row per model run.  Carries `modelId`, `modelVersion`, probability, confidence, diff, opportunity score |
| `ModelInput` | Signals the model saw at estimate time (source, key, value, weight, contribution, timestamp, freshness) |
| `PaperTrade` | Hypothetical positions.  Records the full model state at entry |
| `Resolution` | Settled markets (yes/no/void) |
| `WatchlistItem` | Starred markets with price/model snapshot at the time starred |
| `Alert` | Opportunity + system alerts |
| `AppSetting` | Settings and sync bookkeeping |
| `ModelPerformance` | Rolled-up per-model performance |
| `DataSourceRecord` | Cache for external-source fetches + opportunity snapshots |

### Opportunity score

`lib/math/opportunity.ts :: computeOpportunityScore` is a product-form 0–100 score:

```
score = clamp01(
  probDiffContribution       // |model_p − market_p| / 0.3
  × confidenceMultiplier     // confidence + confidenceFloor
  × liquidityMultiplier      // liquidity / liquiditySaturationCents
  × spreadPenalty            // 1 − spread/(2 × spreadPenaltyCents)
  × timeMultiplier           // bell curve around idealSecondsToClose
  × freshnessMultiplier      // 0.5 ^ (dataAgeSec / freshnessDecaySec)
  × (0.5 + 0.5 × calibration)
) × 100
```

- Returns `{ insufficient: true, score: 0 }` when the market or model probability is missing.
- Returns `{ insufficient: false, score: 0 }` when the diff is below `minProbDiff` (default 2 pts).
- The `components` object on the return value is exposed on the market detail page so you can see *why* a market scored where it did.

### Models and the "insufficient data" contract

- `genericModel` only produces an estimate when it has at least a market anchor (bid/ask or last price) and either a category prior or decent liquidity.  Confidence is capped at ~0.3.
- `weather`, `economics`, and `sports` currently return `insufficient_data`.  The registry falls back to the generic model so these markets still appear in the scanner, but the detail page shows the specialist's refusal reason via `notes`.

To add another model:

1. Create `lib/models/<name>.ts` exporting a `ProbabilityModel` with a stable `version` string.
2. Add it to the `MODELS` array in `lib/models/registry.ts` (specialist models go before `genericModel`).
3. Have `estimate()` populate `inputs` with every signal it looked at, including `timestamp` and `freshnessSec`.  That is the audit trail.
4. If you depend on an external source, add an adapter under `lib/data-sources/<name>.ts` returning a `DataSourceEnvelope`; cache via `readCached` / `writeCached`.
5. Add unit tests under `tests/models.test.ts` or a new `tests/<name>.test.ts`.

### Paper trading

- Click **Paper trade** on any market detail page.  The form captures side, entry price, contracts, and notes.  Everything else — model probability, market probability, confidence, opportunity score, model id/version, estimate id — is snapshotted automatically.
- On settlement (recorded via `lib/resolutions.ts :: recordResolution`), open paper trades for that market are evaluated with `paperTradePnl` and their rows updated with `pnlCents`, `roi`, `correct`, and `resolvedValueCents`.
- The `/performance` page aggregates: win rate, average Brier, average log loss, cumulative P&L, calibration buckets, and breakdowns by category / confidence / diff / entry-price buckets.

### Automated trading

The user asked for a trading bot.  V1 ships the *architecture* for one but intentionally does **not** place live orders:

- `lib/bot/strategy.ts :: runTradingBotTick` iterates recent high-opportunity estimates, applies Kelly sizing, enforces bankroll ceilings and open-exposure limits, and emits paper trades.
- Live mode is gated by:
  1. `KALSHI_LIVE_TRADING_ENABLED=1` in the env (defaults to `0`).
  2. `meetsCalibrationThreshold()` — at least 50 resolved paper trades with an average Brier below `0.22`.
- Even when both gates pass, V1 returns a `live-disabled` tick result because the Kalshi auth signer is not implemented.  This is deliberate so the system can collect calibration data first and prove it has edge before it ever risks real money.

To actually enable live trading later you would need to:

1. Implement the Kalshi API-key signing in `lib/kalshi/client.ts :: request` (populate `KALSHI-ACCESS-KEY`, `KALSHI-ACCESS-SIGNATURE`, `KALSHI-ACCESS-TIMESTAMP` per Kalshi's docs; load the PEM key from `KALSHI_PRIVATE_KEY_PATH`).
2. Add a `placeOrder()` call in `lib/kalshi/` that posts to `/portfolio/orders`.
3. Replace the `return { mode: "live-disabled", ... }` branch in `strategy.ts` with the live order path, keeping the Kelly + bankroll checks in front.
4. Run the bot in paper mode for a long time, confirm positive calibration + ROI, and only then flip the flag.

### Data refresh

- Market data refreshes on the interval set by `settings.marketRefreshSec` (default 60s).  The dashboard's `RefreshButton` kicks the sync on a `setInterval`.
- Model estimates are produced inline inside `syncMarkets`.
- External-source adapters (NOAA, FRED, BLS) will persist cache entries via `DataSourceRecord` with explicit `retrievedAt` / `expiresAt`, and models must check `stale` before using them.

## Testing

```
npm run test
```

Covers probability conversions, mid-implied probability + spread math, expected value / ROI, Brier and log loss, Kelly fraction and fractional stake, paper-trade P&L (yes/no/void), opportunity score across insufficient / strong / spread penalty / freshness decay cases, and generic-model behavior.

## What is intentionally NOT in V1

- Subscriptions, orgs, multi-user accounts, billing, marketing pages — this is personal software.
- Live-money order placement, Kalshi auth signer — see "Automated trading".
- Real NOAA / FRED / BLS integrations — architecture only; Phase 5.
- Real-time WebSocket feed — polling is sufficient while a human watches the dashboard.
- Browser notifications — Phase 4+.

## Troubleshooting

- **"Environment variable not found: DATABASE_URL"** — The scripts load `.env` via `tsx --env-file=.env` or Next.js' built-in env loader.  Make sure you've copied `.env.example` to `.env`.
- **The scanner is empty** — Hit the Refresh button or `POST /api/refresh`.  First page load auto-syncs when the DB is empty.
- **The data looks fake** — It is.  `KALSHI_MOCK_MODE=1` is the default so the app is usable before you register with Kalshi.  Set it to `0` and point `KALSHI_API_BASE` at the real API to use public endpoints.
