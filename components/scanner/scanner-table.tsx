"use client";

import * as React from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, SlidersHorizontal, Star } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { fmtCents, fmtInt, fmtPct, fmtPoints, fmtTimeToClose } from "@/lib/format";
import { COPY, friendlyStatus } from "@/lib/glossary";
import { seriesName, sportGroup } from "@/lib/series";
import { groupByEvent, type EventGroup } from "@/lib/event-groups";
import { EventCard } from "./event-card";

export interface ScannerRow {
  ticker: string;
  title: string;
  eventTicker: string | null;
  eventTitle: string;
  outcomeLabel: string | null;
  seriesTicker: string | null;
  category: string | null;
  yesPriceCents: number | null;
  noPriceCents: number | null;
  modelProbability: number | null;
  marketProbability: number | null;
  diffPoints: number | null;
  expectedRoiBps: number | null;
  confidence: number | null;
  liquidityCents: number;
  spreadCents: number | null;
  volume: number;
  closeTime: string | null;
  status: string;
  opportunityScore: number | null;
  modelStatus: "ok" | "insufficient_data" | "error";
  modelId: string | null;
  tier: "none" | "watch" | "possible" | "edge";
  tags: string[];
  isOpportunity: boolean;
  onWatchlist: boolean;
}

export interface ScannerFilters {
  topic: string;
  series: string;
  minDiffPoints: number;
  minConfidence: number;
  minLiquidityCents: number;
  maxSpreadCents: number;
  minPriceCents: number;
  maxPriceCents: number;
  watchlistOnly: boolean;
  opportunitiesOnly: boolean;
  search: string;
  showExtraColumns: boolean;
  view: "cards" | "table";
}

const DEFAULT_FILTERS: ScannerFilters = {
  topic: "all",
  series: "all",
  minDiffPoints: 0,
  minConfidence: 0,
  minLiquidityCents: 0,
  maxSpreadCents: 100,
  minPriceCents: 1,
  maxPriceCents: 99,
  watchlistOnly: false,
  opportunitiesOnly: false,
  search: "",
  showExtraColumns: false,
  view: "cards",
};

// Canonical order for the topic tabs.  Topics not in this list get appended
// at the end in alphabetical order.
const TOPIC_ORDER = ["Sports", "Economics", "Weather", "Crypto", "Finance", "Politics"];

export function ScannerTable({
  rows,
  categories,
  defaultFilters,
}: {
  rows: ScannerRow[];
  categories: string[];
  defaultFilters?: Partial<ScannerFilters>;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "opportunityScore", desc: true },
  ]);
  const [filters, setFilters] = React.useState<ScannerFilters>({
    ...DEFAULT_FILTERS,
    ...defaultFilters,
  });

  // Build the ordered topic list and count rows per topic for the tab chips.
  const topicCounts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = r.category ?? "Other";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  const topics = React.useMemo(() => {
    const known = TOPIC_ORDER.filter((t) => categories.includes(t));
    const extras = categories.filter((c) => !TOPIC_ORDER.includes(c)).sort();
    return ["all", ...known, ...extras];
  }, [categories]);

  const filtered = React.useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q) && !r.ticker.toLowerCase().includes(q)) {
        return false;
      }
      if (filters.topic !== "all" && (r.category ?? "Other") !== filters.topic) return false;
      if (filters.series !== "all") {
        // When the topic is Sports, the pill value is a league group
        // ("NFL", "NBA", ...) which maps across many series tickers.
        if (filters.topic === "Sports") {
          const group = sportGroup(r.seriesTicker) ?? "Other sports";
          if (group !== filters.series) return false;
        } else if ((r.seriesTicker ?? "") !== filters.series) {
          return false;
        }
      }
      if (filters.opportunitiesOnly && !r.isOpportunity) return false;
      if (filters.watchlistOnly && !r.onWatchlist) return false;
      if (
        filters.minDiffPoints > 0 &&
        (r.diffPoints == null || Math.abs(r.diffPoints) < filters.minDiffPoints)
      )
        return false;
      if (filters.minConfidence > 0 && (r.confidence ?? 0) < filters.minConfidence) return false;
      if (filters.minLiquidityCents > 0 && r.liquidityCents < filters.minLiquidityCents) return false;
      if (filters.maxSpreadCents < 100 && (r.spreadCents ?? 0) > filters.maxSpreadCents) return false;
      if (r.yesPriceCents != null) {
        if (r.yesPriceCents < filters.minPriceCents) return false;
        if (r.yesPriceCents > filters.maxPriceCents) return false;
      }
      return true;
    });
  }, [rows, filters]);

  // Pills available within the currently selected topic.  For Sports we
  // collapse series tickers down to a major-league label (NFL / NBA / MLB /
  // Soccer / Tennis / UFC …) so you can filter by sport instead of by every
  // Kalshi sub-series.  For every other topic we keep series-level pills
  // since those usually name distinct real-world things (Fed decisions, CPI,
  // Unemployment, etc).
  const seriesInTopic = React.useMemo(() => {
    const matchesTopic = (r: ScannerRow) =>
      filters.topic === "all" || (r.category ?? "Other") === filters.topic;
    const counts = new Map<string, number>();
    const useSportGroups = filters.topic === "Sports";
    for (const r of rows) {
      if (!matchesTopic(r) || !r.seriesTicker) continue;
      const key = useSportGroups
        ? sportGroup(r.seriesTicker) ?? "Other sports"
        : r.seriesTicker;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([ticker, count]) => ({
        ticker,
        name: useSportGroups ? ticker : seriesName(ticker),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [rows, filters.topic]);

  // When the topic changes, drop the series selection so stale series don't
  // apply.  Guard with a ref so the effect only fires on real topic changes.
  const prevTopicRef = React.useRef(filters.topic);
  React.useEffect(() => {
    if (prevTopicRef.current !== filters.topic) {
      prevTopicRef.current = filters.topic;
      if (filters.series !== "all") {
        setFilters((f) => ({ ...f, series: "all" }));
      }
    }
  }, [filters.topic, filters.series]);

  const groups: EventGroup[] = React.useMemo(() => {
    const tierRank: Record<string, number> = { edge: 3, possible: 2, watch: 1, none: 0 };
    const g = groupByEvent(filtered);
    return g.sort((a, b) => {
      const ta = tierRank[a.topTier] ?? 0;
      const tb = tierRank[b.topTier] ?? 0;
      if (ta !== tb) return tb - ta;
      const sa = a.topScore ?? -1;
      const sb = b.topScore ?? -1;
      if (sa !== sb) return sb - sa;
      const ca = a.closeTime ? new Date(a.closeTime).getTime() : Infinity;
      const cb = b.closeTime ? new Date(b.closeTime).getTime() : Infinity;
      return ca - cb;
    });
  }, [filtered]);

  const columns = React.useMemo<ColumnDef<ScannerRow>[]>(() => {
    const essential: ColumnDef<ScannerRow>[] = [
      col({
        key: "title",
        header: COPY.colMarket.label,
        hint: COPY.colMarket.hint,
        canSort: false,
        cell: (row) => (
          <div className="flex min-w-[22ch] max-w-[46ch] flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              {row.onWatchlist ? <Star className="h-3 w-3 fill-amber-300 text-amber-300" /> : null}
              <Link
                href={`/markets/${encodeURIComponent(row.ticker)}`}
                className="font-medium text-zinc-100 hover:text-emerald-400"
              >
                {row.title}
              </Link>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              {row.ticker}
            </span>
          </div>
        ),
      }),
      col({
        key: "yesPriceCents",
        header: COPY.colYesPrice.label,
        hint: COPY.colYesPrice.hint,
        cell: (row) => (
          <span className="font-tabular">
            {row.yesPriceCents != null ? `${row.yesPriceCents}¢` : "—"}
          </span>
        ),
      }),
      col({
        key: "modelProbability",
        header: COPY.colOurEstimate.label,
        hint: COPY.colOurEstimate.hint,
        cell: (row) => (
          <span className="font-tabular">
            {row.modelStatus === "insufficient_data" ? (
              <span className="text-zinc-500">no guess</span>
            ) : (
              fmtPct(row.modelProbability, 1)
            )}
          </span>
        ),
      }),
      col({
        key: "diffPoints",
        header: COPY.colGap.label,
        hint: COPY.colGap.hint,
        sortingFn: (a, b) => Math.abs(a.diffPoints ?? 0) - Math.abs(b.diffPoints ?? 0),
        cell: (row) => {
          const v = row.diffPoints;
          if (v == null) return <span className="text-zinc-500">—</span>;
          const color = v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "";
          return <span className={`font-tabular ${color}`}>{fmtPoints(v, 1)}</span>;
        },
      }),
      col({
        key: "expectedRoiBps",
        header: COPY.colIfRight.label,
        hint: COPY.colIfRight.hint,
        sortingFn: (a, b) => (a.expectedRoiBps ?? 0) - (b.expectedRoiBps ?? 0),
        cell: (row) => {
          const v = row.expectedRoiBps;
          if (v == null) return <span className="text-zinc-500">—</span>;
          const color = v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "";
          return <span className={`font-tabular ${color}`}>{(v / 100).toFixed(2)}%</span>;
        },
      }),
      col({
        key: "confidence",
        header: COPY.colConfidence.label,
        hint: COPY.colConfidence.hint,
        cell: (row) => <span className="font-tabular">{fmtPct(row.confidence, 0)}</span>,
      }),
      col({
        key: "closeTime",
        header: COPY.colCloses.label,
        hint: COPY.colCloses.hint,
        sortingFn: (a, b) => {
          const ta = a.closeTime ? new Date(a.closeTime).getTime() : Infinity;
          const tb = b.closeTime ? new Date(b.closeTime).getTime() : Infinity;
          return ta - tb;
        },
        cell: (row) => (
          <span className="font-tabular text-zinc-400">{fmtTimeToClose(row.closeTime)}</span>
        ),
      }),
      col({
        key: "status",
        header: COPY.colStatus.label,
        hint: COPY.colStatus.hint,
        cell: (row) => <TierBadge tier={row.tier} tagCount={row.tags.length} />,
      }),
      col({
        key: "opportunityScore",
        header: COPY.colScore.label,
        hint: COPY.colScore.hint,
        cell: (row) => (
          <span className="font-tabular text-zinc-100">
            {row.opportunityScore != null ? row.opportunityScore.toFixed(1) : "—"}
          </span>
        ),
      }),
    ];
    if (!filters.showExtraColumns) return essential;
    // Insert the extras in a logical order (after YES price, before status).
    const extras: ColumnDef<ScannerRow>[] = [
      col({
        key: "noPriceCents",
        header: COPY.colNoPrice.label,
        hint: COPY.colNoPrice.hint,
        cell: (row) => (
          <span className="font-tabular">
            {row.noPriceCents != null ? `${row.noPriceCents}¢` : "—"}
          </span>
        ),
      }),
      col({
        key: "liquidityCents",
        header: COPY.colLiquidity.label,
        hint: COPY.colLiquidity.hint,
        cell: (row) => (
          <span className="font-tabular text-zinc-300">{fmtCents(row.liquidityCents)}</span>
        ),
      }),
      col({
        key: "spreadCents",
        header: COPY.colSpread.label,
        hint: COPY.colSpread.hint,
        cell: (row) => (
          <span className="font-tabular">
            {row.spreadCents == null ? "—" : `${row.spreadCents}¢`}
          </span>
        ),
      }),
      col({
        key: "volume",
        header: COPY.colVolume.label,
        hint: COPY.colVolume.hint,
        cell: (row) => (
          <span className="font-tabular text-zinc-400">{fmtInt(row.volume)}</span>
        ),
      }),
    ];
    // Splice extras after the YES price column (index 1).
    return [essential[0], essential[1], extras[0], extras[1], extras[2], extras[3], ...essential.slice(2)];
  }, [filters.showExtraColumns]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const activeAdvancedFilters =
    (filters.minDiffPoints > 0 ? 1 : 0) +
    (filters.minConfidence > 0 ? 1 : 0) +
    (filters.minLiquidityCents > 0 ? 1 : 0) +
    (filters.maxSpreadCents < 100 ? 1 : 0) +
    (filters.minPriceCents > 1 ? 1 : 0) +
    (filters.maxPriceCents < 99 ? 1 : 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Topic tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
        {topics.map((t) => {
          const count = t === "all" ? rows.length : topicCounts.get(t) ?? 0;
          const active = filters.topic === t;
          return (
            <button
              key={t}
              onClick={() => setFilters((f) => ({ ...f, topic: t }))}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
                active
                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <span>{t === "all" ? "All topics" : t}</span>
              <span
                className={`font-tabular text-[10px] ${
                  active ? "text-emerald-200" : "text-zinc-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-topic (series) pills */}
      {seriesInTopic.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-[11px]">
          <span className="mr-1 text-[10px] uppercase tracking-wider text-zinc-500">narrow</span>
          <SeriesPill
            name="any series"
            active={filters.series === "all"}
            onClick={() => setFilters((f) => ({ ...f, series: "all" }))}
          />
          {seriesInTopic.slice(0, 24).map((s) => (
            <SeriesPill
              key={s.ticker}
              name={s.name}
              count={s.count}
              active={filters.series === s.ticker}
              onClick={() => setFilters((f) => ({ ...f, series: s.ticker }))}
            />
          ))}
          {seriesInTopic.length > 24 ? (
            <span className="text-[10px] text-zinc-500">+ {seriesInTopic.length - 24} more</span>
          ) : null}
        </div>
      ) : null}

      {/* Compact filter row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
        <Input
          className="w-56"
          placeholder="search markets…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <Button
          size="sm"
          variant={filters.opportunitiesOnly ? "primary" : "outline"}
          onClick={() =>
            setFilters((f) => ({ ...f, opportunitiesOnly: !f.opportunitiesOnly }))
          }
        >
          only worth-a-look
        </Button>
        <Button
          size="sm"
          variant={filters.watchlistOnly ? "primary" : "outline"}
          onClick={() => setFilters((f) => ({ ...f, watchlistOnly: !f.watchlistOnly }))}
        >
          only my watchlist
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              <SlidersHorizontal className="h-3 w-3" />
              More filters
              {activeAdvancedFilters > 0 ? (
                <Badge variant="info" className="ml-1">
                  {activeAdvancedFilters}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="mb-2 text-[11px] font-semibold text-zinc-200">Advanced filters</div>
            <div className="flex flex-col gap-2">
              <NumRow
                label="Minimum disagreement (pts)"
                value={filters.minDiffPoints}
                step={1}
                onChange={(v) => setFilters((f) => ({ ...f, minDiffPoints: v }))}
              />
              <NumRow
                label="Minimum confidence (0–1)"
                value={filters.minConfidence}
                step={0.05}
                max={1}
                onChange={(v) => setFilters((f) => ({ ...f, minConfidence: v }))}
              />
              <NumRow
                label="Min money in market (¢)"
                value={filters.minLiquidityCents}
                step={1000}
                onChange={(v) => setFilters((f) => ({ ...f, minLiquidityCents: v }))}
              />
              <NumRow
                label="Max buy/sell gap (¢)"
                value={filters.maxSpreadCents}
                step={1}
                max={100}
                onChange={(v) => setFilters((f) => ({ ...f, maxSpreadCents: v }))}
              />
              <NumRow
                label="Min YES price (¢)"
                value={filters.minPriceCents}
                step={1}
                max={99}
                onChange={(v) => setFilters((f) => ({ ...f, minPriceCents: v }))}
              />
              <NumRow
                label="Max YES price (¢)"
                value={filters.maxPriceCents}
                step={1}
                max={99}
                onChange={(v) => setFilters((f) => ({ ...f, maxPriceCents: v }))}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    minDiffPoints: 0,
                    minConfidence: 0,
                    minLiquidityCents: 0,
                    maxSpreadCents: 100,
                    minPriceCents: 1,
                    maxPriceCents: 99,
                  }))
                }
              >
                reset advanced
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {filters.view === "table" ? (
          <Button
            size="sm"
            variant={filters.showExtraColumns ? "primary" : "ghost"}
            onClick={() =>
              setFilters((f) => ({ ...f, showExtraColumns: !f.showExtraColumns }))
            }
          >
            {filters.showExtraColumns ? "fewer columns" : "more columns"}
          </Button>
        ) : null}
        <div className="flex items-center gap-0.5 rounded-md bg-zinc-900 p-0.5">
          <button
            onClick={() => setFilters((f) => ({ ...f, view: "cards" }))}
            className={`rounded-sm px-2 py-1 text-[11px] transition-colors ${
              filters.view === "cards"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            cards
          </button>
          <button
            onClick={() => setFilters((f) => ({ ...f, view: "table" }))}
            className={`rounded-sm px-2 py-1 text-[11px] transition-colors ${
              filters.view === "table"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            table
          </button>
        </div>
        <span className="ml-auto text-[11px] text-zinc-500">
          {filters.view === "cards"
            ? `${groups.length.toLocaleString()} events · ${filtered.length.toLocaleString()} markets`
            : `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} markets`}
        </span>
      </div>

      {/* Body: cards or table */}
      {filters.view === "cards" ? (
        <div className="flex-1 overflow-auto px-6 py-6">
          {groups.length === 0 ? (
            <div className="py-16 text-center text-xs text-zinc-500">
              nothing matches these filters
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-7 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {groups.slice(0, 180).map((g) => (
                <EventCard key={g.key} group={g} />
              ))}
            </div>
          )}
          {groups.length > 180 ? (
            <div className="pt-3 text-center text-[11px] text-zinc-500">
              showing first 180 events — tighten the filters above to see more
            </div>
          ) : null}
        </div>
      ) : (
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={canSort ? "cursor-pointer select-none" : undefined}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort ? (
                          sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )
                        ) : null}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-zinc-500">
                  nothing matches these filters
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  );
}

function TierBadge({
  tier,
  tagCount,
}: {
  tier: ScannerRow["tier"];
  tagCount: number;
}) {
  if (tier === "edge") return <Badge variant="positive">worth a bet</Badge>;
  if (tier === "possible") return <Badge variant="info">worth a look</Badge>;
  if (tier === "watch") {
    return (
      <Badge variant="warning">
        1 signal{tagCount > 1 ? ` (+${tagCount - 1})` : ""}
      </Badge>
    );
  }
  return <Badge variant="default">quiet</Badge>;
}

function SeriesPill({
  name,
  count,
  active,
  onClick,
}: {
  name: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors ${
        active
          ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40"
          : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
    >
      <span>{name}</span>
      {count != null ? (
        <span className={active ? "text-sky-200/80" : "text-zinc-500"}>{count}</span>
      ) : null}
    </button>
  );
}

function col({
  key,
  header,
  hint,
  cell,
  canSort = true,
  sortingFn,
}: {
  key: keyof ScannerRow;
  header: string;
  hint: string;
  cell: (row: ScannerRow) => React.ReactNode;
  canSort?: boolean;
  sortingFn?: (a: ScannerRow, b: ScannerRow) => number;
}): ColumnDef<ScannerRow> {
  const def: ColumnDef<ScannerRow> = {
    accessorKey: key as string,
    enableSorting: canSort,
    header: () => (
      <span className="inline-flex items-center gap-1">
        <span>{header}</span>
        {hint ? <InfoHint>{hint}</InfoHint> : null}
      </span>
    ),
    cell: ({ row }) => cell(row.original),
  };
  if (sortingFn) {
    def.sortingFn = (rowA, rowB) => sortingFn(rowA.original, rowB.original);
  }
  return def;
}

function NumRow({
  label,
  value,
  step,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="flex-1 text-[11px] normal-case tracking-normal text-zinc-300">{label}</Label>
      <Input
        type="number"
        className="h-7 w-24 text-xs"
        value={value}
        step={step}
        min={0}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
