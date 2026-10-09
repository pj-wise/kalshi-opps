// Thin, dependency-free Kalshi HTTP client.
//
// Public (unauthenticated) endpoints work out of the box.  Signed/authenticated
// requests are stubbed: the signer is wired, but we deliberately do NOT ship a
// live-trading surface in V1.  See docs/ for details.

import { readKalshiEnv, type KalshiEnv } from "./env";

export interface KalshiRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
  /** Mark the request as requiring auth. If creds are missing, throws. */
  requiresAuth?: boolean;
}

export class KalshiError extends Error {
  readonly status: number;
  readonly path: string;
  constructor(status: number, path: string, message: string) {
    super(`Kalshi ${status} on ${path}: ${message}`);
    this.status = status;
    this.path = path;
  }
}

export class KalshiAuthRequiredError extends Error {
  constructor(path: string) {
    super(`Kalshi auth required for ${path} but no credentials configured`);
  }
}

export class KalshiClient {
  readonly env: KalshiEnv;

  constructor(env: KalshiEnv = readKalshiEnv()) {
    this.env = env;
  }

  get hasAuth(): boolean {
    return Boolean(this.env.keyId && this.env.privateKeyPath);
  }

  async request<T>(path: string, opts: KalshiRequestOptions = {}): Promise<T> {
    const method = opts.method ?? "GET";
    const url = new URL(this.env.apiBase.replace(/\/$/, "") + path);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v == null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = {
      "Accept": "application/json",
      "User-Agent": "betgg-local/0.1 (+local)",
    };
    if (opts.requiresAuth) {
      if (!this.hasAuth) throw new KalshiAuthRequiredError(path);
      // Signer intentionally not implemented in V1.  See README.
      throw new KalshiAuthRequiredError(
        path + " (authenticated requests disabled in V1)",
      );
    }
    const init: RequestInit = {
      method,
      headers,
      signal: opts.signal,
    };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    // Retry on 429 (rate limit) with exponential backoff.  Kalshi's public
    // API caps us at a few requests per second so a short retry loop is
    // usually enough to recover without surfacing an error.
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, init);
      if (res.status === 429 && attempt < 2) {
        const backoffMs = 500 * (attempt + 1);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      const text = await res.text();
      if (!res.ok) {
        throw new KalshiError(res.status, path, text.slice(0, 500));
      }
      try {
        return text ? (JSON.parse(text) as T) : (undefined as T);
      } catch (err) {
        throw new KalshiError(500, path, `invalid JSON: ${(err as Error).message}`);
      }
    }
    throw new KalshiError(429, path, "exceeded retry budget");
  }
}
