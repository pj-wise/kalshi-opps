import { NextResponse } from "next/server";
import { syncMarkets } from "@/lib/sync";

// One sync at a time. Every open tab auto-refreshes on its own timer, and a
// sync can take longer than the interval, so overlapping runs would pile up
// writes and lock SQLite. Callers that arrive mid-sync wait on the run already
// in flight instead of starting another.
let inFlight: ReturnType<typeof syncMarkets> | null = null;

export async function POST(req: Request) {
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "fast") as "full" | "fast";
  try {
    if (!inFlight) {
      inFlight = syncMarkets(undefined, { mode }).finally(() => {
        inFlight = null;
      });
    }
    const result = await inFlight;
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
