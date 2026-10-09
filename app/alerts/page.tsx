import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AlertsPage() {
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { market: true },
  });
  return (
    <div className="flex flex-1 flex-col gap-3 p-3">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Alerts</h1>
        <p className="mt-1 text-xs text-zinc-400">
          Heads-ups the dashboard logs when something interesting happens — a market crossed a
          threshold, data stopped refreshing, etc.
        </p>
      </div>
      {alerts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No alerts right now</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-400">
            Alerts show up here when a market gets interesting. You can tune when that happens in{" "}
            <Link href="/settings" className="text-emerald-400">
              Settings
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>
                    {a.market ? (
                      <Link href={`/markets/${encodeURIComponent(a.market.ticker)}`} className="text-zinc-100 hover:text-emerald-400">
                        {a.title}
                      </Link>
                    ) : (
                      a.title
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.severity === "critical" ? "negative" : a.severity === "warning" ? "warning" : "info"}>
                      {a.severity}
                    </Badge>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {fmtRelativeTime(a.createdAt)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-zinc-300">{a.body}</CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
