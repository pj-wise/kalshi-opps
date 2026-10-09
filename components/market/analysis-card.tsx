import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { COPY } from "@/lib/glossary";
import { fmtPct, fmtPoints } from "@/lib/format";

export interface AnalysisProps {
  marketProbability: number | null;
  modelProbability: number | null;
  diffPoints: number | null;
  confidence: number | null;
  opportunityScore: number | null;
  modelStatus: "ok" | "insufficient_data" | "error";
  expectedRoiBps: number | null;
}

export function AnalysisCard(props: AnalysisProps) {
  const insufficient = props.modelStatus !== "ok";
  return (
    <div>
      <div className="mb-2 text-xs text-zinc-400">
        <span className="text-zinc-200">In plain English:</span> the market thinks the chance of YES
        is on the left; our estimate is next to it. If those two numbers disagree a lot <em>and</em>
        we&apos;re reasonably sure, this market might be worth a bet.
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              {COPY.marketPrice.label}
              <InfoHint>{COPY.marketPrice.hint}</InfoHint>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>{fmtPct(props.marketProbability, 1)}</CardValue>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              {COPY.modelEstimate.label}
              <InfoHint>{COPY.modelEstimate.hint}</InfoHint>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insufficient ? (
              <div className="flex flex-col gap-1">
                <Badge variant="warning">not enough info to guess</Badge>
                <span className="text-[10px] text-zinc-500">
                  we do not have enough signal to form an independent view
                </span>
              </div>
            ) : (
              <CardValue>{fmtPct(props.modelProbability, 1)}</CardValue>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              {COPY.gap.label}
              <InfoHint>{COPY.gap.hint}</InfoHint>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue
              className={
                props.diffPoints == null
                  ? undefined
                  : props.diffPoints > 0
                    ? "text-emerald-400"
                    : props.diffPoints < 0
                      ? "text-red-400"
                      : undefined
              }
            >
              {fmtPoints(props.diffPoints, 1)}
            </CardValue>
            <div className="mt-0.5 text-[10px] text-zinc-500">
              {props.diffPoints == null
                ? ""
                : props.diffPoints > 0
                  ? "we think YES is more likely than the market"
                  : props.diffPoints < 0
                    ? "we think YES is less likely than the market"
                    : ""}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              {COPY.confidence.label}
              <InfoHint>{COPY.confidence.hint}</InfoHint>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>{fmtPct(props.confidence, 0)}</CardValue>
            <div className="mt-0.5 text-[10px] text-zinc-500">
              {props.confidence == null
                ? ""
                : props.confidence < 0.25
                  ? "low — treat the gap with caution"
                  : props.confidence < 0.5
                    ? "moderate"
                    : "high"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              {COPY.estRoi.label}
              <InfoHint>{COPY.estRoi.hint}</InfoHint>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue
              className={
                props.expectedRoiBps == null
                  ? undefined
                  : props.expectedRoiBps > 0
                    ? "text-emerald-400"
                    : props.expectedRoiBps < 0
                      ? "text-red-400"
                      : undefined
              }
            >
              {props.expectedRoiBps == null ? "—" : `${(props.expectedRoiBps / 100).toFixed(2)}%`}
            </CardValue>
            <div className="mt-0.5 text-[10px] text-zinc-500">average profit per $1 bet, in theory</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              {COPY.score.label}
              <InfoHint>{COPY.score.hint}</InfoHint>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>
              {props.opportunityScore == null ? "—" : `${props.opportunityScore.toFixed(1)}/100`}
            </CardValue>
            <div className="mt-0.5 text-[10px] text-zinc-500">
              {props.opportunityScore == null
                ? ""
                : props.opportunityScore < 25
                  ? "quiet — probably skip"
                  : props.opportunityScore < 50
                    ? "mildly interesting"
                    : props.opportunityScore < 75
                      ? "worth a closer look"
                      : "stands out"}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
