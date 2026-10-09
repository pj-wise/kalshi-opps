import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalibrationChart } from "@/components/performance/calibration-chart";
import { PnlChart } from "@/components/performance/pnl-chart";
import { fmtCents, fmtPct } from "@/lib/format";
import { COPY } from "@/lib/glossary";
import { getPerformanceReport } from "@/lib/performance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PerformancePage() {
  const report = await getPerformanceReport();
  return (
    <div className="flex flex-1 flex-col gap-3 p-3">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Track record</h1>
        <p className="mt-1 text-xs text-zinc-400">
          How accurate our estimates have been so far, and how a pretend portfolio would have done.
          Everything on this page is based on <span className="text-zinc-200">pretend bets</span> — no
          real money is involved.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
        <Metric
          label={COPY.perfPredictionsLogged.label}
          hint={COPY.perfPredictionsLogged.hint}
          value={report.totalPredictions.toLocaleString()}
        />
        <Metric
          label={COPY.perfResolved.label}
          hint={COPY.perfResolved.hint}
          value={report.resolvedPredictions.toLocaleString()}
        />
        <Metric
          label={COPY.perfWinRate.label}
          hint={COPY.perfWinRate.hint}
          value={report.winRate == null ? "—" : fmtPct(report.winRate, 1)}
        />
        <Metric
          label={COPY.perfBrier.label}
          hint={COPY.perfBrier.hint}
          value={report.avgBrier == null ? "—" : report.avgBrier.toFixed(3)}
          valueClass={
            report.avgBrier == null
              ? undefined
              : report.avgBrier < 0.2
                ? "text-emerald-400"
                : report.avgBrier > 0.25
                  ? "text-red-400"
                  : undefined
          }
          subtitle={
            report.avgBrier == null
              ? "need more settled bets"
              : report.avgBrier < 0.2
                ? "better than a coin flip"
                : report.avgBrier > 0.25
                  ? "worse than a coin flip"
                  : "about a coin flip"
          }
        />
        <Metric
          label={COPY.perfLogLoss.label}
          hint={COPY.perfLogLoss.hint}
          value={report.avgLogLoss == null ? "—" : report.avgLogLoss.toFixed(3)}
        />
        <Metric
          label="Pretend P&L"
          hint="Running total if you'd placed every pretend bet with real money."
          value={fmtCents(report.paperPnlCents, { sign: true })}
          valueClass={
            report.paperPnlCents > 0 ? "text-emerald-400" : report.paperPnlCents < 0 ? "text-red-400" : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              {COPY.perfCalibration.label}
              <InfoHint>{COPY.perfCalibration.hint}</InfoHint>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CalibrationChart buckets={report.calibration} />
            <p className="mt-2 text-[11px] text-zinc-500">
              The green line should hug the dashed line. If it sits above, we were under-confident
              (things happened more often than we said). If below, we were over-confident. The bars
              show how many settled bets are in each bucket.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              {COPY.perfCumulative.label}
              <InfoHint>{COPY.perfCumulative.hint}</InfoHint>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PnlChart points={report.cumulativePnl} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <BreakdownCard
          title={COPY.perfByCategory.label}
          intro="Which topics are we actually any good at?"
          rows={report.byCategory.map((r) => ({ label: r.category, ...r }))}
          showPnl
        />
        <BreakdownCard
          title={COPY.perfByConfidence.label}
          intro="When we said we were sure, did it pay off?"
          rows={report.byConfidenceBucket.map((r) => ({ label: r.bucket, ...r }))}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <BreakdownCard
          title={COPY.perfByGap.label}
          intro="Did bigger disagreements with the market mean we were more right, or just more wrong?"
          rows={report.byDiffBucket.map((r) => ({ label: r.bucket, ...r }))}
        />
        <BreakdownCard
          title={COPY.perfByPrice.label}
          intro="How did we do when betting cheap longshots vs. favorites?"
          rows={report.byMarketPriceBucket.map((r) => ({ label: r.bucket, ...r }))}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  hint,
  value,
  valueClass,
  subtitle,
}: {
  label: string;
  hint: string | null;
  value: string;
  valueClass?: string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1">
          {label}
          {hint ? <InfoHint>{hint}</InfoHint> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CardValue className={valueClass}>{value}</CardValue>
        {subtitle ? <div className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</div> : null}
      </CardContent>
    </Card>
  );
}

interface BreakdownRow {
  label: string;
  count: number;
  avgBrier: number | null;
  winRate: number | null;
  pnlCents?: number;
}

function BreakdownCard({
  title,
  intro,
  rows,
  showPnl,
}: {
  title: string;
  intro: string;
  rows: BreakdownRow[];
  showPnl?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-[11px] text-zinc-500">{intro}</p>
        {rows.length === 0 ? (
          <div className="py-4 text-xs text-zinc-500">
            No settled bets yet. This will fill in once some markets resolve.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bucket</TableHead>
                <TableHead>Bets</TableHead>
                <TableHead>Win rate</TableHead>
                <TableHead>Brier (lower = better)</TableHead>
                {showPnl ? <TableHead>Pretend P&amp;L</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="font-tabular">{r.label}</TableCell>
                  <TableCell className="font-tabular">{r.count.toLocaleString()}</TableCell>
                  <TableCell className="font-tabular">
                    {r.winRate == null ? "—" : fmtPct(r.winRate, 1)}
                  </TableCell>
                  <TableCell className="font-tabular">
                    {r.avgBrier == null ? "—" : r.avgBrier.toFixed(3)}
                  </TableCell>
                  {showPnl ? (
                    <TableCell className="font-tabular">
                      {fmtCents(r.pnlCents ?? 0, { sign: true })}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
