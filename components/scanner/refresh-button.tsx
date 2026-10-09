"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshButton({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"fast" | "full" | null>(null);
  const [lastRun, setLastRun] = React.useState<Date | null>(null);
  const [nextInSec, setNextInSec] = React.useState<number>(Math.round(intervalMs / 1000));

  const run = React.useCallback(
    async (mode: "fast" | "full") => {
      setPending(mode);
      try {
        await fetch(`/api/refresh?mode=${mode}`, { method: "POST" });
        setLastRun(new Date());
        setNextInSec(Math.round(intervalMs / 1000));
        router.refresh();
      } finally {
        setPending(null);
      }
    },
    [router, intervalMs],
  );

  // Auto-refresh (fast) on interval.
  React.useEffect(() => {
    const id = setInterval(() => {
      run("fast");
    }, intervalMs);
    return () => clearInterval(id);
  }, [run, intervalMs]);

  // Countdown display.
  React.useEffect(() => {
    const id = setInterval(() => {
      setNextInSec((s) => (s <= 1 ? Math.round(intervalMs / 1000) : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [intervalMs]);

  const busy = pending != null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-zinc-500">
        {pending === "fast"
          ? "refreshing prices…"
          : pending === "full"
            ? "re-crawling everything (several minutes)…"
            : `next refresh in ${nextInSec}s`}
      </span>
      <Button variant="outline" size="sm" onClick={() => run("fast")} disabled={busy}>
        <RefreshCw className={`h-3 w-3 ${pending === "fast" ? "animate-spin" : ""}`} />
        {pending === "fast" ? "Refreshing…" : "Refresh prices"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => run("full")} disabled={busy}>
        <Download className={`h-3 w-3 ${pending === "full" ? "animate-pulse" : ""}`} />
        {pending === "full" ? "Crawling…" : "Full re-crawl"}
      </Button>
      {lastRun ? (
        <span className="text-[11px] text-zinc-500">· {lastRun.toLocaleTimeString()}</span>
      ) : null}
    </div>
  );
}
