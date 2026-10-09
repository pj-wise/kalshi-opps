// Normalized shape every external data source returns.
//
// The adapters live in this folder and must speak this interface so models
// cannot accidentally consume stale data without noticing.

export interface DataSourceEnvelope<T> {
  source: string;
  key: string;
  value: T;
  retrievedAt: Date;
  expiresAt: Date | null;
  metadata: Record<string, unknown> | null;
  stale: boolean;
}

export interface DataSourceAdapter<Params, Value> {
  readonly source: string;
  fetch(params: Params): Promise<DataSourceEnvelope<Value>>;
}
