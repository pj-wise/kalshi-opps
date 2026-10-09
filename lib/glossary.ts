// Plain-English labels + tooltip copy for everything the dashboard shows.
// Keep in one place so terminology stays consistent across the scanner,
// market-detail, performance, and settings pages.

export const COPY = {
  // ─── Summary cards ────────────────────────────────────────────────────────
  marketsScanned: {
    label: "Markets we're watching",
    hint: "How many Kalshi markets we currently track and run our estimate against.",
  },
  opportunities: {
    label: "Possibly interesting",
    hint: "Markets where our estimate disagrees with the market and the odds look reasonable to actually bet on. Not a guarantee — just worth a closer look.",
  },
  avgDiff: {
    label: "Average disagreement",
    hint: "On average, how far apart our estimate is from the market right now, in percentage points.",
  },
  paperPnl: {
    label: "Pretend P&L",
    hint: "How you'd be doing if you'd placed every paper bet with real money. No real money is ever touched.",
  },
  accuracy: {
    label: "How accurate have we been?",
    hint: "Brier score: 0 is perfect, 0.25 is a coin flip, 1 is as wrong as possible. We only compute this once some paper bets have resolved.",
  },

  // ─── Scanner table columns ────────────────────────────────────────────────
  colMarket: { label: "Market", hint: "The question Kalshi will settle." },
  colCategory: { label: "Topic", hint: "Loose grouping (sports, economics, etc)." },
  colYesPrice: {
    label: "Cost of YES",
    hint: "What one YES contract costs right now, in cents. Pays 100¢ if the answer turns out to be YES, 0¢ if NO.",
  },
  colNoPrice: {
    label: "Cost of NO",
    hint: "What one NO contract costs right now. Pays 100¢ if the answer turns out to be NO.",
  },
  colOurEstimate: {
    label: "Our estimate",
    hint: "Our best guess at the chance the market resolves YES.",
  },
  colGap: {
    label: "Gap",
    hint: "How far our estimate is from the market's price, in percentage points. Positive = we think YES is more likely than the market does.",
  },
  colIfRight: {
    label: "If we're right",
    hint: "The expected profit per $1 bet, if our estimate is correct on average. Positive means it looks profitable in theory.",
  },
  colConfidence: {
    label: "How sure",
    hint: "How much we trust our own estimate. Low means we're mostly reflecting what the market says.",
  },
  colLiquidity: {
    label: "Money in market",
    hint: "Approximate amount of money sitting in the order book. Easier to buy and sell when this is high.",
  },
  colSpread: {
    label: "Buy/sell gap",
    hint: "The gap between the YES buy price and the YES sell price, in cents. A tighter gap is better.",
  },
  colVolume: {
    label: "Trades so far",
    hint: "Total contracts traded in this market.",
  },
  colCloses: { label: "Closes in", hint: "How long until trading on this market closes." },
  colStatus: {
    label: "Status",
    hint: "Opportunity means we flagged it. Insufficient info means we don't have enough signal to guess.",
  },
  colScore: {
    label: "Interest score",
    hint: "A 0-to-100 score that blends the gap, our confidence, the liquidity, the spread, time left, and freshness. Higher means more worth looking at — not a predicted return.",
  },

  // ─── Analysis card on market detail ───────────────────────────────────────
  marketPrice: { label: "Market's chance", hint: "What the market currently thinks the chance of YES is." },
  modelEstimate: { label: "Our estimate", hint: "Our best guess at the chance of YES." },
  gap: { label: "Disagreement", hint: "The gap between our estimate and the market, in percentage points." },
  confidence: { label: "How sure we are", hint: "Our own confidence in the estimate. Low confidence should temper enthusiasm about the gap." },
  estRoi: { label: "If right, per $1 bet", hint: "What you'd expect to profit per $1 bet if our estimate is correct on average." },
  score: {
    label: "Interest score",
    hint: "0-100 blend of the gap, confidence, liquidity, spread, time, freshness. Higher = more worth a closer look. Not a predicted return.",
  },

  // ─── Market detail other sections ─────────────────────────────────────────
  priceHistory: { label: "Price history", hint: "How the market's price (and our estimate) have moved over time." },
  marketFacts: { label: "Facts about this market", hint: null },
  modelInputs: {
    label: "What our estimate looked at",
    hint: "Every signal that fed into our guess, with when we saw it and how much it mattered.",
  },
  orderbook: { label: "Buy and sell orders", hint: "The open YES orders waiting to be matched. Green = people wanting to buy, red = people wanting to sell." },
  risk: {
    label: "Suggested bet size",
    hint: "Kelly sizing: a classic bankroll-growth formula. Shown for information only. Default recommendation is 1/4 Kelly — a conservative fraction.",
  },

  // ─── Performance page ─────────────────────────────────────────────────────
  perfPredictionsLogged: { label: "Guesses logged", hint: "How many times we recorded an estimate so far." },
  perfResolved: { label: "Settled bets", hint: "How many paper bets have reached their settlement date." },
  perfWinRate: { label: "Win rate", hint: "Share of paper bets that ended up correct." },
  perfBrier: {
    label: "Brier score",
    hint: "Classic accuracy score for probability guesses. 0 is perfect, 0.25 is a coin flip, 1 is as wrong as possible. Lower is better.",
  },
  perfLogLoss: {
    label: "Log loss",
    hint: "Another accuracy score, same spirit as Brier but harsher on confident-and-wrong guesses. Lower is better.",
  },
  perfCalibration: {
    label: "Are our guesses actually right that often?",
    hint: "When we say '70% chance', do things really happen 70% of the time? The green line should hug the dashed line. Bars show how many bets fell in each bucket.",
  },
  perfCumulative: {
    label: "Pretend P&L over time",
    hint: "What your running paper-money total would look like.",
  },
  perfByCategory: { label: "How we did by topic", hint: null },
  perfByConfidence: { label: "How we did when we were more / less sure", hint: null },
  perfByGap: { label: "How we did by size of disagreement", hint: null },
  perfByPrice: { label: "How we did by starting price", hint: null },

  // ─── Settings ─────────────────────────────────────────────────────────────
  settingsScanner: { label: "What counts as interesting", hint: null },
  settingsMinGap: {
    label: "Minimum disagreement (percentage points)",
    hint: "Markets with less than this gap between our estimate and the price are ignored.",
  },
  settingsMinConfidence: {
    label: "Minimum confidence (0 to 1)",
    hint: "Markets where we're less sure than this won't be flagged.",
  },
  settingsMinLiquidity: {
    label: "Minimum money in market (cents)",
    hint: "Skip markets where there isn't enough money moving to easily buy or sell.",
  },
  settingsMaxSpread: {
    label: "Maximum buy/sell gap (cents)",
    hint: "Skip markets where the buy and sell prices are too far apart.",
  },
  settingsSnapshot: {
    label: "Save a snapshot when the interest score is at least",
    hint: "A reminder gets logged whenever a market crosses this score, even if you don't paper-trade it.",
  },
  settingsAlert: {
    label: "Flag as 'possibly interesting' at this score",
    hint: "The threshold that turns a market green on the scanner.",
  },
  settingsBankroll: {
    label: "Pretend bankroll (cents)",
    hint: "The imaginary wallet size used for Kelly sizing and exposure math.",
  },
  settingsKelly: {
    label: "Kelly fraction (0 to 1)",
    hint: "Fraction of the Kelly stake to suggest. 0.25 (one quarter Kelly) is a common conservative default.",
  },
  settingsMarketRefresh: { label: "How often to refresh prices (seconds)", hint: "The dashboard pings Kalshi this often." },
  settingsModelRefresh: { label: "How often to re-estimate (seconds)", hint: null },
  settingsHistoryRetention: {
    label: "Days of history to keep",
    hint: "Older price snapshots and model estimates are deleted to keep the database small. Each market's latest estimate and anything tied to a paper trade are always kept.",
  },
} as const;

// Short, human-readable name for a Kalshi market status.
export function friendlyStatus(status: string): string {
  switch (status) {
    case "active":
      return "Open";
    case "unopened":
      return "Not yet open";
    case "closed":
      return "Trading closed";
    case "settled":
      return "Settled";
    case "determined":
      return "Decided";
    default:
      return status;
  }
}

// Plain-English translation for the model's self-reported status.
export function friendlyModelStatus(status: string): string {
  switch (status) {
    case "ok":
      return "Estimate ready";
    case "insufficient_data":
      return "Not enough info to guess";
    case "error":
      return "Error";
    default:
      return status;
  }
}
