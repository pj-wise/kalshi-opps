// Centralized env resolution for the Kalshi integration.
// Treat anything but "0"/"false"/"" as truthy so .env strings are easy to use.

function boolEnv(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "" || normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return true;
}

export interface KalshiEnv {
  apiBase: string;
  keyId: string | null;
  privateKeyPath: string | null;
  mockMode: boolean;
  liveTradingEnabled: boolean;
  botBankrollCents: number;
  botMaxPositionCents: number;
}

export function readKalshiEnv(): KalshiEnv {
  const keyId = (process.env.KALSHI_KEY_ID ?? "").trim() || null;
  const privateKeyPath = (process.env.KALSHI_PRIVATE_KEY_PATH ?? "").trim() || null;
  const apiBase =
    (process.env.KALSHI_API_BASE ?? "").trim() ||
    "https://api.elections.kalshi.com/trade-api/v2";
  const mockEnvForced = boolEnv(process.env.KALSHI_MOCK_MODE, false);
  // If creds are missing we can still hit public endpoints, but anything
  // requiring auth will fall back to mock mode automatically.
  const mockMode = mockEnvForced;
  return {
    apiBase,
    keyId,
    privateKeyPath,
    mockMode,
    liveTradingEnabled: boolEnv(process.env.KALSHI_LIVE_TRADING_ENABLED, false),
    botBankrollCents: Number(process.env.TRADING_BOT_BANKROLL_CENTS ?? 0) || 0,
    botMaxPositionCents: Number(process.env.TRADING_BOT_MAX_POSITION_CENTS ?? 0) || 0,
  };
}
