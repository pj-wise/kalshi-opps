// Human-readable names for Kalshi series tickers.
//
// The series prefix (first segment of a Kalshi ticker, e.g. KXNFLGAME) is a
// stable grouping that we expose as sub-topic pills under the main category
// tabs. Known series get hand-written names; everything else falls back to a
// cleaned-up version of the ticker.

const KNOWN_SERIES: Record<string, { name: string; category: string }> = {
  // ─── Sports: weekly games ────────────────────────────────────────────────
  KXNFLGAME: { name: "NFL games", category: "Sports" },
  KXNBAGAME: { name: "NBA games", category: "Sports" },
  KXMLBGAME: { name: "MLB games", category: "Sports" },
  KXNHLGAME: { name: "NHL games", category: "Sports" },
  KXWNBAGAME: { name: "WNBA games", category: "Sports" },
  KXMLSGAME: { name: "MLS games", category: "Sports" },
  KXEPLGAME: { name: "Premier League games", category: "Sports" },
  KXUFCGAME: { name: "UFC fights", category: "Sports" },

  // ─── Sports: futures / season-long ──────────────────────────────────────
  KXNFLMVP: { name: "NFL MVP", category: "Sports" },
  KXNFLSB: { name: "Super Bowl", category: "Sports" },
  KXNFLDRAFT: { name: "NFL draft", category: "Sports" },
  KXNFLDRAFTWR: { name: "NFL draft — WRs", category: "Sports" },
  KXNFLDRAFTDB: { name: "NFL draft — DBs", category: "Sports" },
  KXNFLDRAFTTOP: { name: "NFL draft — top picks", category: "Sports" },
  KXNFLFIRSTPICK: { name: "NFL first pick", category: "Sports" },
  KXNFLRETIRE: { name: "NFL retirements", category: "Sports" },
  KXNFLCAREERPASSYDS: { name: "NFL career passing yds", category: "Sports" },
  KXNFLCAREERRECYDS: { name: "NFL career receiving yds", category: "Sports" },
  KXNFLCAREERRSHYDS: { name: "NFL career rushing yds", category: "Sports" },
  KXNFLANYTD: { name: "NFL anytime TD", category: "Sports" },
  KXNFLFFPTS: { name: "NFL fantasy points", category: "Sports" },
  KXNFLFFH2HSEASON: { name: "NFL fantasy head-to-head", category: "Sports" },
  KXNFLSACKRECORD: { name: "NFL sack record", category: "Sports" },
  KXNFLSEASONRECTD: { name: "NFL season receiving TDs", category: "Sports" },
  KXNFLFIRSTTDTIME: { name: "NFL first TD time", category: "Sports" },
  KXNFLTEAM1STDOWNS: { name: "NFL team 1st downs", category: "Sports" },
  KXNFLLEADCHANGE: { name: "NFL lead changes", category: "Sports" },
  KXNFLVIEWERSHIP: { name: "NFL viewership", category: "Sports" },
  KXNFLPLAYOFFHOST: { name: "NFL playoff hosts", category: "Sports" },
  KXNFLENDSTREAK: { name: "NFL end-streak markets", category: "Sports" },
  KXMLBDEBUT: { name: "MLB debuts", category: "Sports" },
  KXMLBWS: { name: "World Series", category: "Sports" },
  KXNBACHAMP: { name: "NBA champion", category: "Sports" },
  KXNHLCUP: { name: "Stanley Cup", category: "Sports" },
  KXUCL: { name: "UEFA Champions League", category: "Sports" },
  KXATP: { name: "ATP tennis", category: "Sports" },
  KXWTA: { name: "WTA tennis", category: "Sports" },
  KXPGAFUTURE: { name: "PGA futures", category: "Sports" },
  KXWCHOST: { name: "World Cup hosts", category: "Sports" },
  KXNCAAFCONFLEAVE: { name: "NCAAF conference moves", category: "Sports" },

  // ─── Economics ──────────────────────────────────────────────────────────
  KXFEDFUNDSYEAR: { name: "Fed funds year-end", category: "Economics" },
  KXFEDDECISION: { name: "FOMC rate decisions", category: "Economics" },
  KXUSCPIYEAR: { name: "US CPI year-end", category: "Economics" },
  KXCPIYY: { name: "US CPI monthly", category: "Economics" },
  KXU3EOY: { name: "US unemployment year-end", category: "Economics" },
  KXUNRATE: { name: "US unemployment monthly", category: "Economics" },
  KXGDPYEAR: { name: "US GDP year-end", category: "Economics" },
  KXNOMGDPGROWTH: { name: "Nominal GDP growth", category: "Economics" },
  KXLFPRATEEOY: { name: "Labor force participation", category: "Economics" },
  KXTRADEDEFICIT: { name: "US trade deficit", category: "Economics" },

  // ─── Politics / elections ───────────────────────────────────────────────
  KXNEXTDNCCHAIR: { name: "Next DNC chair", category: "Politics" },
  KXNEXTUKPRIMEMIN: { name: "Next UK PM", category: "Politics" },
  KXNEXTROMANIAPM: { name: "Next Romanian PM", category: "Politics" },
  KXNEXTISRAELPM: { name: "Next Israeli PM", category: "Politics" },
  KXNEXTNATOSECGEN: { name: "Next NATO Secretary General", category: "Politics" },
  KXG7LEADEROUT: { name: "G7 leader to leave", category: "Politics" },
  KXAFRICALEADEROUT: { name: "Africa leader to leave", category: "Politics" },
  KXELECGA: { name: "Georgia elections", category: "Politics" },

  // ─── Finance / crypto ───────────────────────────────────────────────────
  KXBTC: { name: "Bitcoin price", category: "Financials" },
  KXETH: { name: "Ethereum price", category: "Financials" },
  KXSPX: { name: "S&P 500", category: "Financials" },
  KXOIL: { name: "US oil (WTI)", category: "Financials" },

  // ─── Entertainment ──────────────────────────────────────────────────────
  KXACTORSONNYCROCKETT: { name: "Casting: Sonny Crockett", category: "Entertainment" },
  KXPERFORMBONDSONG: { name: "James Bond theme song", category: "Entertainment" },

  // ─── Culture / world ────────────────────────────────────────────────────
  KXNEWPOPE: { name: "Next Pope", category: "World" },
  KXXISUCCESSOR: { name: "Xi Jinping successor", category: "World" },
  KXNEXTTRILLIONAIRE: { name: "Next trillionaire", category: "World" },

  // ─── Science ────────────────────────────────────────────────────────────
  KXELONMARS: { name: "Elon Musk · Mars", category: "Science and Technology" },
  KXYANGMILLS: { name: "Yang–Mills problem", category: "Science and Technology" },
  KXRIEMANNRES: { name: "Riemann hypothesis", category: "Science and Technology" },
  KXPNP: { name: "P vs NP", category: "Science and Technology" },
};

/**
 * Collapse a series ticker (e.g. "KXNFLCAREERPASSYDS", "KXNBASIXTH") down to
 * a major-league label (NFL / NBA / MLB / …).  Returns null for non-sports
 * series.
 *
 * Kalshi series tickers follow a loose convention of starting with the
 * league code after the "KX" prefix.  We hand-match the common ones;
 * anything unmatched that still looks sports-ish falls into "Other sports".
 */
export function sportGroup(seriesTicker: string | null | undefined): string | null {
  if (!seriesTicker) return null;
  const base = seriesTicker.replace(/^KX/, "").toUpperCase();

  // ─── Highest priority: specific leagues that would collide with a broader
  // substring match (WNBA inside NBA, NCAAF inside NFL, etc).
  if (base.startsWith("WNBA")) return "WNBA";
  if (base.startsWith("NCAAF") || base.includes("COLLEGEFOOTBALL")) return "College Football";
  if (
    base.startsWith("NCAAB") ||
    base.startsWith("NCAAM") ||
    base.startsWith("NCAAW") ||
    base.includes("MARCHMADNESS") ||
    base.includes("FINALFOUR")
  ) {
    return "College Basketball";
  }

  // ─── Big four US leagues ───────────────────────────────────────────────
  if (
    base.includes("NFL") ||
    base.includes("SUPERBOWL") ||
    base.startsWith("SB") ||
    base.includes("PRO FOOTBALL") // defensive, in case Kalshi ever adds words
  ) {
    return "NFL";
  }
  if (
    base.includes("NBA") ||
    base.includes("BBALL") ||
    base.includes("BASKETBALL") ||
    base.startsWith("SHAI") ||
    base.startsWith("KD") ||
    base.startsWith("LBJ")
  ) {
    return "NBA";
  }
  if (base.includes("MLB") || base.includes("WORLDSERIES") || base.includes("BASEBALL")) {
    return "MLB";
  }
  if (base.includes("NHL") || base.includes("STANLEYCUP") || base.includes("HOCKEY")) {
    return "NHL";
  }

  // ─── Soccer (everything soccer-ish rolls up here) ──────────────────────
  if (
    base.startsWith("MLS") ||
    base.includes("EPL") ||
    base.includes("PREMIER") ||
    base.startsWith("LALIGA") ||
    base.startsWith("SERIEA") ||
    base.includes("BUND") ||
    base.startsWith("UCL") ||
    base.includes("CHAMPIONSLEAGUE") ||
    base.startsWith("UEFA") ||
    base.startsWith("WC") ||
    base.startsWith("WORLDCUP") ||
    base.startsWith("CLUBWC") ||
    base.startsWith("COPA") ||
    base.startsWith("CONCACAF") ||
    base.startsWith("MANCITY") ||
    base.includes("MANUTD") ||
    base.includes("RONALDO") ||
    base.includes("MESSI") ||
    base.includes("JOINCLUB")
  ) {
    return "Soccer";
  }

  // ─── Combat sports / racquet / golf / motor ────────────────────────────
  if (
    base.startsWith("UFC") ||
    base.startsWith("MMA") ||
    base.startsWith("BELLATOR") ||
    base.startsWith("PFL")
  ) {
    return "UFC";
  }
  if (base.startsWith("BOX")) return "Boxing";
  if (
    base.startsWith("ATP") ||
    base.startsWith("WTA") ||
    base.includes("TENNIS") ||
    base.includes("GRANDSLAM") ||
    base.startsWith("USOPEN") ||
    base.startsWith("WIMBLEDON")
  ) {
    return "Tennis";
  }
  if (
    base.startsWith("PGA") ||
    base.includes("GOLF") ||
    base.startsWith("LIV") ||
    base.startsWith("RYDERCUP") ||
    base.startsWith("MASTERS") ||
    base.startsWith("USOPENGOLF")
  ) {
    return "Golf";
  }
  if (
    base.startsWith("F1") ||
    base.startsWith("FORMULA") ||
    base.startsWith("NASCAR") ||
    base.startsWith("INDY") ||
    base.startsWith("MOTOGP")
  ) {
    return "Motorsports";
  }

  // ─── Niche ─────────────────────────────────────────────────────────────
  if (
    base.includes("ESPORT") ||
    base.startsWith("LOL") ||
    base.startsWith("CSGO") ||
    base.startsWith("DOTA") ||
    base.startsWith("VALORANT")
  ) {
    return "Esports";
  }
  if (base.includes("OLYMPIC")) return "Olympics";
  if (
    base.startsWith("HORSE") ||
    base.startsWith("KYDERBY") ||
    base.startsWith("TRIPLECROWN")
  ) {
    return "Horse racing";
  }
  if (base.startsWith("CRICKET")) return "Cricket";
  if (base.startsWith("RUGBY")) return "Rugby";
  return null;
}

export function seriesName(seriesTicker: string | null | undefined): string {
  if (!seriesTicker) return "Other";
  const known = KNOWN_SERIES[seriesTicker];
  if (known) return known.name;
  // Fallback: strip "KX" prefix, split on dashes, title-case segments.
  const cleaned = seriesTicker.replace(/^KX/, "").replace(/-.*/, "");
  return cleaned
    .replace(/_/g, " ")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
