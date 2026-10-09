"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WatchlistButton({ ticker, onWatchlist }: { ticker: string; onWatchlist: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [active, setActive] = React.useState(onWatchlist);

  const toggle = React.useCallback(async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/watchlist/${encodeURIComponent(ticker)}`, {
        method: active ? "DELETE" : "POST",
      });
      if (res.ok) {
        setActive(!active);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }, [active, ticker, router]);

  return (
    <Button variant={active ? "primary" : "outline"} size="sm" onClick={toggle} disabled={pending}>
      <Star className={`h-3 w-3 ${active ? "fill-white" : ""}`} />
      {active ? "On your watchlist" : "Add to watchlist"}
    </Button>
  );
}
