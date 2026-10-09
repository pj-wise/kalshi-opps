import { prisma } from "@/lib/prisma";
import { syncMarkets } from "@/lib/sync";
import { readSettings } from "@/lib/settings";
import { getCategories, getScannerRows, getSummaryStats } from "@/lib/queries";
import { SummaryCards, DataSourceLine } from "@/components/scanner/summary-cards";
import { ScannerTable } from "@/components/scanner/scanner-table";
import { RefreshButton } from "@/components/scanner/refresh-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  // Seed on first load if there's nothing in the DB yet.  Use "full" so we
  // cover every open series — subsequent refreshes use the faster "fast" mode.
  const totalMarkets = await prisma.market.count();
  if (totalMarkets === 0) {
    try {
      await syncMarkets(undefined, { mode: "full" });
    } catch (err) {
      console.error("[page] initial sync failed", err);
    }
  }

  const [stats, rows, categories, settings] = await Promise.all([
    getSummaryStats(),
    getScannerRows(),
    getCategories(),
    readSettings(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-3 py-1.5">
        <DataSourceLine stats={stats} />
        <RefreshButton intervalMs={settings.marketRefreshSec * 1000} />
      </div>
      <SummaryCards stats={stats} />
      <ScannerTable rows={rows} categories={categories} />
    </div>
  );
}
