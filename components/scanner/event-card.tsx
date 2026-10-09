"use client";

import Link from "next/link";
import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ProbabilityBar } from "./probability-bar";
import type { ScannerRow } from "./scanner-table";
import type { EventGroup } from "@/lib/event-groups";
import { fmtCents, fmtPct, fmtPoints, fmtTimeToClose } from "@/lib/format";
import { seriesName } from "@/lib/series";
import { TAG_LABELS, type MarketTag } from "@/lib/math/opportunity";
import { tierReason } from "@/lib/tier-reason";
import { cn } from "@/lib/utils";

// Tier → visual palette.  Border + outer glow use the same hue so the card
// reads at a glance like the Kalshi cards: green = act, blue = inspect,
// amber = soft heads-up.
// Tier → visual palette.
//
// Pure box-shadow can't be strictly bottom-right only because it's a copy of
// the whole element outline offset by (x, y) — the shadow always "wraps" to
// the opposite sides as well.  To constrain the glow to the bottom-right
// corner we use a blurred color blob positioned there via a pseudo element.
//
// `glowBg` controls the blob color.  `ring` + `accent*` style the card itself.
// Each tier gets a tiny colored "accent line" that traces only the bottom-right
// corner of the card and fades out along the bottom and right edges.  The
// technique: a 1px-padded outer div with a radial gradient origin anchored to
// the bottom-right corner, then a solid-background inner div covering the
// center.  Only the 1px gap at the corner reveals the gradient — the top and
// left edges stay neutral grey.
const BORDER_FALLBACK = "rgb(39 39 42)"; // zinc-800
const TIER_STYLES: Record<
  ScannerRow["tier"],
  { cornerBorder: string; accentText: string; accentBg: string }
> = {
  edge: {
    cornerBorder:
      "radial-gradient(ellipse 85% 85% at 100% 100%, rgba(16,185,129,0.95) 0%, rgba(39,39,42,1) 55%)",
    accentText: "text-emerald-300",
    accentBg: "bg-emerald-500/15",
  },
  possible: {
    cornerBorder:
      "radial-gradient(ellipse 85% 85% at 100% 100%, rgba(56,189,248,0.9) 0%, rgba(39,39,42,1) 55%)",
    accentText: "text-sky-300",
    accentBg: "bg-sky-500/10",
  },
  watch: {
    cornerBorder:
      "radial-gradient(ellipse 85% 85% at 100% 100%, rgba(245,158,11,0.75) 0%, rgba(39,39,42,1) 55%)",
    accentText: "text-amber-300",
    accentBg: "bg-amber-500/10",
  },
  none: {
    cornerBorder: BORDER_FALLBACK,
    accentText: "",
    accentBg: "",
  },
};

export function EventCard({ group }: { group: EventGroup }) {
  const styles = TIER_STYLES[group.topTier];
  const reason = tierReason(group);

  return (
    <div className="relative">
      {/* Gradient border: 1px wrapper filled with a radial gradient whose
          origin is the bottom-right corner — the colored line is brightest
          there and fades to the neutral zinc hue by the time it reaches the
          top-left.  The inner div covers the center so only a 1px ring
          shows the gradient at the edges. */}
      <div
        className="relative rounded-md p-px"
        style={{ background: styles.cornerBorder }}
      >
      <div className="relative flex flex-col justify-between gap-2 rounded-[5px] bg-zinc-950 p-3 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            {group.onWatchlist ? (
              <Star className="h-3 w-3 shrink-0 fill-amber-300 text-amber-300" />
            ) : null}
            <h3 className="truncate text-sm font-medium text-zinc-100">{group.eventTitle}</h3>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            {group.seriesTicker ? (
              <Badge variant="outline">{seriesName(group.seriesTicker)}</Badge>
            ) : null}
            {group.category ? <span>{group.category}</span> : null}
            <span>·</span>
            <span>{fmtTimeToClose(group.closeTime)}</span>
          </div>
        </div>
        <TierBadge tier={group.topTier} />
      </div>

      {/* Plain-English "why" line */}
      {reason ? (
        <div
          className={cn(
            "rounded-sm px-2 py-1.5 text-[11px] leading-snug",
            styles.accentBg,
            styles.accentText || "text-zinc-300",
          )}
        >
          {reason.sentence}
        </div>
      ) : null}

      {/* Body — picks the layout based on group kind */}
      {group.kind === "binary" ? (
        <BinaryBody row={group.rows[0]} />
      ) : group.kind === "matchup" ? (
        <MatchupBody rows={group.rows} />
      ) : (
        <MultiBody rows={group.rows} />
      )}

      {/* Footer: liquidity, score, specific-tag chips */}
      <Footer group={group} />
      </div>
      </div>
    </div>
  );
}

function Footer({ group }: { group: EventGroup }) {
  const tagsForDisplay = group.tags.filter((t): t is MarketTag => t in TAG_LABELS);
  return (
    <div className="mt-1 flex flex-col gap-1 border-t border-zinc-800 pt-2 text-[10px] text-zinc-500">
      <div className="flex items-center justify-between gap-2">
        <span>{fmtCents(group.totalLiquidityCents)} in market</span>
        {group.topScore != null ? (
          <span>
            interest <span className="text-zinc-200">{group.topScore.toFixed(0)}</span>/100
          </span>
        ) : null}
      </div>
      {tagsForDisplay.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tagsForDisplay.slice(0, 3).map((t) => (
            <span
              key={t}
              className={cn(
                "rounded-sm px-1 py-px text-[10px]",
                t === "arb_sum_low" || t === "arb_sum_high"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-zinc-800 text-zinc-300",
              )}
            >
              {TAG_LABELS[t]}
            </span>
          ))}
          {tagsForDisplay.length > 3 ? (
            <span className="text-zinc-600">+ {tagsForDisplay.length - 3}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BinaryBody({ row }: { row: ScannerRow }) {
  return (
    <Link
      href={`/markets/${encodeURIComponent(row.ticker)}`}
      className="flex flex-col gap-1.5 rounded-sm px-1 py-1 hover:bg-zinc-900/60"
    >
      <div className="flex items-center justify-between text-xs text-zinc-200">
        <span>YES</span>
        <span className="font-tabular">
          {row.yesPriceCents != null ? `${row.yesPriceCents}¢` : "—"}
        </span>
      </div>
      <ProbabilityBar
        marketCents={row.yesPriceCents}
        modelProb={row.modelProbability}
      />
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>
          our est{" "}
          <span className="text-zinc-300 font-tabular">
            {row.modelStatus === "insufficient_data" ? "n/a" : fmtPct(row.modelProbability, 0)}
          </span>
        </span>
        <GapBadge diffPoints={row.diffPoints} />
      </div>
    </Link>
  );
}

function MatchupBody({ rows }: { rows: ScannerRow[] }) {
  const [a, b] = rows;
  return (
    <div className="grid grid-cols-2 gap-2">
      {[a, b].map((row) => (
        <Link
          key={row.ticker}
          href={`/markets/${encodeURIComponent(row.ticker)}`}
          className="flex flex-col gap-1.5 rounded-sm bg-zinc-900/50 p-2 hover:bg-zinc-800/60"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="truncate text-zinc-100">{row.outcomeLabel ?? "YES"}</span>
            <span className="font-tabular text-zinc-100">
              {row.yesPriceCents != null ? `${row.yesPriceCents}¢` : "—"}
            </span>
          </div>
          <ProbabilityBar
            marketCents={row.yesPriceCents}
            modelProb={row.modelProbability}
            compact
          />
          <div className="flex items-center justify-between text-[10px] text-zinc-500">
            <span className="font-tabular">
              {row.modelStatus === "insufficient_data" ? "no guess" : fmtPct(row.modelProbability, 0)}
            </span>
            <GapBadge diffPoints={row.diffPoints} compact />
          </div>
        </Link>
      ))}
    </div>
  );
}

function MultiBody({ rows }: { rows: ScannerRow[] }) {
  const shown = rows.slice(0, 5);
  const hidden = rows.length - shown.length;
  return (
    <div className="flex flex-col gap-1.5">
      {shown.map((row) => (
        <Link
          key={row.ticker}
          href={`/markets/${encodeURIComponent(row.ticker)}`}
          className="flex items-center gap-2 rounded-sm px-1 py-0.5 hover:bg-zinc-900/60"
        >
          <span className="w-32 shrink-0 truncate text-xs text-zinc-200" title={row.outcomeLabel ?? ""}>
            {row.outcomeLabel ?? "YES"}
          </span>
          <div className="min-w-0 flex-1">
            <ProbabilityBar
              marketCents={row.yesPriceCents}
              modelProb={row.modelProbability}
              compact
            />
          </div>
          <span className="w-10 shrink-0 text-right font-tabular text-xs text-zinc-100">
            {row.yesPriceCents != null ? `${row.yesPriceCents}¢` : "—"}
          </span>
          <span className="w-14 shrink-0 text-right text-[10px] text-zinc-500">
            {row.modelStatus === "insufficient_data" ? "" : (
              <GapBadge diffPoints={row.diffPoints} compact />
            )}
          </span>
        </Link>
      ))}
      {hidden > 0 ? (
        <div className="pt-0.5 text-[10px] text-zinc-500">+ {hidden} more candidates</div>
      ) : null}
    </div>
  );
}

function TierBadge({ tier }: { tier: ScannerRow["tier"] }) {
  if (tier === "edge") {
    return (
      <Badge variant="positive" className="shrink-0">
        worth a bet
      </Badge>
    );
  }
  if (tier === "possible") {
    return (
      <Badge variant="info" className="shrink-0">
        worth a look
      </Badge>
    );
  }
  if (tier === "watch") {
    return (
      <Badge variant="warning" className="shrink-0">
        signal
      </Badge>
    );
  }
  return null;
}

function GapBadge({
  diffPoints,
  compact,
}: {
  diffPoints: number | null;
  compact?: boolean;
}) {
  if (diffPoints == null) {
    return <span className="text-zinc-600">—</span>;
  }
  const color = diffPoints > 0 ? "text-emerald-400" : diffPoints < 0 ? "text-red-400" : "text-zinc-500";
  return (
    <span className={`font-tabular ${color} ${compact ? "" : "ml-2"}`}>
      {fmtPoints(diffPoints, 1)}
    </span>
  );
}
