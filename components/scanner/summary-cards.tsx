import { Database, FlaskConical, Radio, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { InfoHint } from "@/components/ui/info-hint";
import { fmtCents, fmtPoints } from "@/lib/format";
import { COPY } from "@/lib/glossary";

export interface SummaryStats {
  marketsScanned: number;
  opportunities: number;
  avgDiffPoints: number | null;
  paperPnlCents: number | null;
  brierScore: number | null;
  resolvedCount: number;
  lastSync: string | null;
  dataSource: "live" | "mock-forced" | "mock-fallback" | "unknown";
  fallbackReason: string | null;
}

// Slim one-line strip of stats across the top of the scanner.
export function SummaryCards({ stats }: { stats: SummaryStats }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
      <Stat
        label={COPY.marketsScanned.label}
        hint={COPY.marketsScanned.hint}
        value={stats.marketsScanned.toLocaleString()}
      />
      <Stat
        label={COPY.opportunities.label}
        hint={COPY.opportunities.hint}
        value={stats.opportunities.toLocaleString()}
        valueClass={stats.opportunities > 0 ? "text-emerald-400" : undefined}
      />
      <Stat
        label={COPY.avgDiff.label}
        hint={COPY.avgDiff.hint}
        value={fmtPoints(stats.avgDiffPoints, 1)}
      />
      <Stat
        label={COPY.paperPnl.label}
        hint={COPY.paperPnl.hint}
        value={fmtCents(stats.paperPnlCents, { sign: true })}
        valueClass={
          stats.paperPnlCents == null
            ? undefined
            : stats.paperPnlCents > 0
              ? "text-emerald-400"
              : stats.paperPnlCents < 0
                ? "text-red-400"
                : undefined
        }
      />
      <Stat
        label={COPY.accuracy.label}
        hint={COPY.accuracy.hint}
        value={stats.brierScore == null ? "—" : stats.brierScore.toFixed(3)}
        subtitle={
          stats.resolvedCount === 0
            ? "need settled bets"
            : `${stats.resolvedCount} settled`
        }
      />
    </div>
  );
}

function Stat({
  label,
  hint,
  value,
  valueClass,
  subtitle,
}: {
  label: string;
  hint: string;
  value: string;
  valueClass?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="flex items-center gap-1 text-[10px] text-zinc-500">
        <span>{label}</span>
        <InfoHint>{hint}</InfoHint>
      </span>
      <span className={`font-tabular text-sm text-zinc-100 ${valueClass ?? ""}`}>{value}</span>
      {subtitle ? <span className="text-[9px] text-zinc-600">{subtitle}</span> : null}
    </div>
  );
}

// Compact header row with data-source + refresh info. Caller supplies the
// outer container so this composes with the manual refresh button.
export function DataSourceLine({ stats }: { stats: SummaryStats }) {
  const live = stats.dataSource === "live";
  const forced = stats.dataSource === "mock-forced";
  const fellBack = stats.dataSource === "mock-fallback";
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
      {live ? (
        <Badge variant="positive" className="flex items-center gap-1">
          <Radio className="h-3 w-3" /> live Kalshi data
        </Badge>
      ) : forced ? (
        <Badge variant="info" className="flex items-center gap-1">
          <FlaskConical className="h-3 w-3" /> mock data (forced in .env)
        </Badge>
      ) : fellBack ? (
        <Badge variant="warning" className="flex items-center gap-1">
          <TriangleAlert className="h-3 w-3" /> mock data — couldn&apos;t reach Kalshi
        </Badge>
      ) : (
        <Badge variant="default" className="flex items-center gap-1">
          <Database className="h-3 w-3" /> no refresh yet
        </Badge>
      )}
      {fellBack && stats.fallbackReason ? (
        <span className="text-zinc-500">{truncate(stats.fallbackReason, 90)}</span>
      ) : null}
      {stats.lastSync ? (
        <span>Last refresh {fmtRelative(stats.lastSync)}</span>
      ) : (
        <span>Never refreshed yet</span>
      )}
    </div>
  );
}

function fmtRelative(iso: string) {
  const d = new Date(iso);
  const diff = Math.round((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86_400)}d ago`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

// Backwards-compat (home page used to import LastSyncLine).
export const LastSyncLine = DataSourceLine;
