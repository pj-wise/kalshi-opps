// Formatting helpers used by UI components.  Centralized so number display is
// consistent across the dashboard, scanner, and detail page.

export function fmtPct(p: number | null | undefined, digits = 0): string {
  if (p == null || Number.isNaN(p)) return "—";
  return `${(p * 100).toFixed(digits)}%`;
}

export function fmtPoints(points: number | null | undefined, digits = 1): string {
  if (points == null || Number.isNaN(points)) return "—";
  const sign = points > 0 ? "+" : points < 0 ? "" : "";
  return `${sign}${points.toFixed(digits)} pts`;
}

export function fmtCents(cents: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (cents == null || Number.isNaN(cents)) return "—";
  const dollars = cents / 100;
  const str = dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  if (!opts.sign) return str;
  if (dollars > 0) return `+${str}`;
  return str;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US");
}

export function fmtRelativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = d.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const sec = Math.round(abs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  const past = diffMs < 0;
  let value: string;
  if (sec < 60) value = `${sec}s`;
  else if (min < 60) value = `${min}m`;
  else if (hr < 48) value = `${hr}h`;
  else value = `${day}d`;
  return past ? `${value} ago` : `in ${value}`;
}

export function fmtTimeToClose(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = d.getTime() - Date.now();
  if (diffMs < 0) return "closed";
  const sec = Math.floor(diffMs / 1000);
  const day = Math.floor(sec / 86_400);
  const hr = Math.floor((sec - day * 86_400) / 3600);
  const min = Math.floor((sec - day * 86_400 - hr * 3600) / 60);
  if (day > 0) return `${day}d ${hr}h`;
  if (hr > 0) return `${hr}h ${min}m`;
  return `${min}m`;
}
