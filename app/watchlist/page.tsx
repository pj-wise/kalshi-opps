import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtCents, fmtPct, fmtPoints, fmtRelativeTime, fmtTimeToClose } from "@/lib/format";
import { midImpliedProbability } from "@/lib/math/probability";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WatchlistPage() {
  const items = await prisma.watchlistItem.findMany({
    orderBy: { addedAt: "desc" },
    include: {
      market: {
        include: {
          estimates: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  return (
    <div className="flex flex-1 flex-col gap-3 p-3">
      <h1 className="text-lg font-semibold text-zinc-100">Watchlist</h1>
      <p className="text-xs text-zinc-400">
        Markets you starred, with the price and our estimate at the time you added them so you can
        see what has changed since.
      </p>
      {items.length === 0 ? (
        <div className="text-xs text-zinc-500">
          Nothing on your watchlist yet. Open any market and tap{" "}
          <span className="text-zinc-200">Watch</span> to add it here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => {
            const m = it.market;
            const est = m.estimates[0];
            const nowYes =
              midImpliedProbability(m.lastYesBidCents, m.lastYesAskCents, m.lastPriceCents) ??
              null;
            const yesCentsNow = m.lastYesAskCents ?? m.lastPriceCents ?? null;
            const priceDelta =
              yesCentsNow != null && it.addedYesPriceCents != null
                ? yesCentsNow - it.addedYesPriceCents
                : null;
            const modelDelta =
              est?.probability != null && it.addedModelProbability != null
                ? est.probability - it.addedModelProbability
                : null;
            return (
              <Card key={it.id}>
                <CardHeader>
                  <CardTitle>
                    <Link href={`/markets/${encodeURIComponent(m.ticker)}`} className="text-zinc-100 hover:text-emerald-400">
                      {m.title}
                    </Link>
                  </CardTitle>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="font-mono">{m.ticker}</span>
                    {m.category ? <Badge variant="outline">{m.category}</Badge> : null}
                    <span>added {fmtRelativeTime(it.addedAt)}</span>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-xs">
                  <KV label="YES price when you added it" value={it.addedYesPriceCents != null ? `${it.addedYesPriceCents}¢` : "—"} />
                  <KV
                    label="YES price now"
                    value={yesCentsNow != null ? `${yesCentsNow}¢` : "—"}
                    delta={
                      priceDelta == null
                        ? null
                        : { value: `${priceDelta > 0 ? "+" : ""}${priceDelta}¢`, direction: priceDelta }
                    }
                  />
                  <KV label="Our estimate when added" value={fmtPct(it.addedModelProbability)} />
                  <KV
                    label="Our estimate now"
                    value={fmtPct(est?.probability ?? null, 1)}
                    delta={
                      modelDelta == null
                        ? null
                        : {
                            value: fmtPoints(modelDelta * 100, 1),
                            direction: modelDelta,
                          }
                    }
                  />
                  <KV label="Market's chance now" value={fmtPct(nowYes, 1)} />
                  <KV label="Interest score" value={est?.opportunityScore?.toFixed(1) ?? "—"} />
                  <KV label="Money in market" value={fmtCents(m.liquidityCents)} />
                  <KV label="Closes in" value={fmtTimeToClose(m.closeTime)} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KV({ label, value, delta }: { label: string; value: string; delta?: { value: string; direction: number } | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <span className="font-tabular text-zinc-200">{value}</span>
      {delta ? (
        <span
          className={`text-[11px] font-tabular ${delta.direction > 0 ? "text-emerald-400" : delta.direction < 0 ? "text-red-400" : "text-zinc-500"}`}
        >
          change: {delta.value}
        </span>
      ) : null}
    </div>
  );
}
