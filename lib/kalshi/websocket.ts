// Placeholder for the Kalshi WebSocket integration.
//
// The real-time price channel requires authenticated signing.  Since V1 does
// not ship a live-trading surface, the dashboard polls REST on an interval.
// Keeping this file as a documented stub so future code has a landing spot.

export interface KalshiWebSocket {
  connect(): Promise<void>;
  disconnect(): void;
}

export function createKalshiWebSocket(): KalshiWebSocket {
  return {
    async connect() {
      throw new Error(
        "Kalshi WebSocket not implemented in V1. Fall back to polling via GET /markets.",
      );
    },
    disconnect() {
      /* noop */
    },
  };
}
