import { notFound } from "next/navigation";
import Link from "next/link";

import { AnalysisCard } from "@/components/market/analysis-card";
import { KellyInfo } from "@/components/market/kelly-info";
import { ModelInputsTable } from "@/components/market/model-inputs-table";
import { OrderbookView } from "@/components/market/orderbook-view";
import { PaperTradeForm } from "@/components/market/paper-trade-form";
import { PriceHistoryChart } from "@/components/market/price-history-chart";
import { WatchlistButton } from "@/components/market/watchlist-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtCents, fmtInt, fmtTimeToClose } from "@/lib/format";
import { loadMarketDetail } from "@/lib/market-detail";
import { readSettings } from "@/lib/settings";
import { friendlyStatus } from "@/lib/glossary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MarketPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const detail = await loadMarketDetail(decodeURIComponent(ticker));
  if (!detail || !detail.marketRow) notFound();

  const settings = await readSettings();
  const market = detail.marketRow;
  const latest = detail.latestEstimate;

  return (
    <div className="flex flex-1 flex-col gap-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href="/" className="text-[11px] text-zinc-500 hover:text-zinc-200">
            ← back to all markets
          </Link>
          <h1 className="text-lg font-semibold text-zinc-100">{market.title}</h1>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="font-mono text-zinc-400">{market.ticker}</span>
            {market.category ? <Badge variant="outline">{market.category}</Badge> : null}
            <Badge variant="default">{friendlyStatus(market.status)}</Badge>
            <span>closes in {fmtTimeToClose(market.closeTime)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WatchlistButton ticker={market.ticker} onWatchlist={detail.onWatchlist} />
          <PaperTradeForm
            ticker={market.ticker}
            yesAskCents={market.lastYesAskCents ?? null}
            noAskCents={market.lastNoAskCents ?? null}
            modelProbability={latest?.probability ?? null}
            marketProbability={latest?.marketProbability ?? null}
            confidence={latest?.confidence ?? null}
            opportunityScore={latest?.opportunityScore ?? null}
            estimateId={latest?.id ?? null}
            modelId={latest?.modelId ?? null}
            modelVersion={latest?.modelVersion ?? null}
          />
        </div>
      </div>

      <AnalysisCard
        marketProbability={latest?.marketProbability ?? null}
        modelProbability={latest?.probability ?? null}
        diffPoints={latest?.diffPoints ?? null}
        confidence={latest?.confidence ?? null}
        opportunityScore={latest?.opportunityScore ?? null}
        modelStatus={latest?.status ?? "insufficient_data"}
        expectedRoiBps={detail.expectedRoiBps}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Price over time</CardTitle>
          </CardHeader>
          <CardContent>
            <PriceHistoryChart data={detail.priceHistory} />
            <div className="mt-2 flex gap-4 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-3 bg-sky-400" /> what the market has thought
              </span>
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-3 border-t border-dashed border-emerald-400" /> our estimate
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>About this market</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-xs text-zinc-300">
            <KeyVal label="Total trading activity" value={fmtInt(market.volume)} />
            <KeyVal label="Trading today" value={fmtInt(market.volume24h)} />
            <KeyVal label="Open bets" value={fmtInt(market.openInterest)} />
            <KeyVal label="Money in market" value={fmtCents(market.liquidityCents)} />
            <KeyVal
              label="YES: can sell / can buy"
              value={`${market.lastYesBidCents ?? "—"}¢ / ${market.lastYesAskCents ?? "—"}¢`}
            />
            <KeyVal
              label="NO: can sell / can buy"
              value={`${market.lastNoBidCents ?? "—"}¢ / ${market.lastNoAskCents ?? "—"}¢`}
            />
            <KeyVal
              label="Buy/sell gap"
              value={
                market.lastYesAskCents != null && market.lastYesBidCents != null
                  ? `${Math.max(0, market.lastYesAskCents - market.lastYesBidCents)}¢`
                  : "—"
              }
            />
            <KeyVal label="Opened" value={market.openTime?.toLocaleString() ?? "—"} />
            <KeyVal label="Trading closes" value={market.closeTime?.toLocaleString() ?? "—"} />
            <KeyVal label="Settles by" value={market.expirationTime?.toLocaleString() ?? "—"} />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="model">
        <TabsList>
          <TabsTrigger value="model">Why we think that</TabsTrigger>
          <TabsTrigger value="orderbook">Who&apos;s buying and selling</TabsTrigger>
          <TabsTrigger value="risk">Suggested bet size</TabsTrigger>
          <TabsTrigger value="rules">How it settles</TabsTrigger>
        </TabsList>
        <TabsContent value="model">
          <Card>
            <CardHeader>
              <CardTitle>
                What our estimate looked at
                {latest ? (
                  <span className="ml-2 font-mono text-[10px] text-zinc-500">
                    ({latest.modelId} {latest.modelVersion})
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latest?.explanation ? (
                <p className="mb-3 text-xs text-zinc-300">{latest.explanation}</p>
              ) : (
                <p className="mb-3 text-xs text-zinc-500">
                  No estimate has been computed yet. Hit <span className="text-zinc-200">Refresh</span>{" "}
                  on the main page.
                </p>
              )}
              {latest?.notes ? (
                <p className="mb-3 text-xs text-zinc-500">heads-up: {latest.notes}</p>
              ) : null}
              <ModelInputsTable inputs={detail.modelInputs} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="orderbook">
          <Card>
            <CardHeader>
              <CardTitle>Open YES orders waiting to match</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-[11px] text-zinc-500">
                Green rows: people trying to buy YES. Red rows: people trying to sell YES. The number
                next to the price is how many contracts they want.
              </p>
              <OrderbookView yesBids={detail.orderbook.yesBids} yesAsks={detail.orderbook.yesAsks} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="risk">
          <Card>
            <CardHeader>
              <CardTitle>Suggested bet size (information only)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-zinc-400">
                Kelly sizing is a classic formula that tries to grow a bankroll optimally. We default
                to <span className="text-zinc-200">1/4 Kelly</span> because full Kelly swings too hard.
                This never places any real bets.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-[11px] text-zinc-400">
                    If you&apos;d bet YES at {market.lastYesAskCents ?? "—"}¢
                  </div>
                  <KellyInfo
                    side="yes"
                    modelProbability={latest?.probability ?? null}
                    askCents={market.lastYesAskCents ?? null}
                    bankrollCents={settings.defaultBankrollCents}
                  />
                </div>
                <div>
                  <div className="mb-1 text-[11px] text-zinc-400">
                    If you&apos;d bet NO at {market.lastNoAskCents ?? "—"}¢
                  </div>
                  <KellyInfo
                    side="no"
                    modelProbability={latest?.probability ?? null}
                    askCents={market.lastNoAskCents ?? null}
                    bankrollCents={settings.defaultBankrollCents}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>How this market gets decided</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-xs text-zinc-300">
              {market.rulesPrimary ?? "No settlement rules available."}
              {market.rulesSecondary ? `\n\n${market.rulesSecondary}` : ""}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <span className="font-tabular text-zinc-200">{value}</span>
    </div>
  );
}
