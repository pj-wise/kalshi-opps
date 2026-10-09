"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COPY } from "@/lib/glossary";
import type { Settings } from "@/lib/settings";

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [state, setState] = React.useState<Settings>(initial);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const save = React.useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${res.status})`);
      }
      setSavedAt(new Date());
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [state, router]);

  return (
    <div className="flex flex-col gap-3">
      <SectionCard
        title="What counts as 'worth a look'?"
        intro="These filters decide which markets show up as green on the main page."
      >
        <NumField
          label={COPY.settingsMinGap.label}
          hint={COPY.settingsMinGap.hint}
          value={state.minProbabilityDiffPoints}
          onChange={(v) => setState((s) => ({ ...s, minProbabilityDiffPoints: v }))}
        />
        <NumField
          label={COPY.settingsMinConfidence.label}
          hint={COPY.settingsMinConfidence.hint}
          step={0.05}
          max={1}
          value={state.minConfidence}
          onChange={(v) => setState((s) => ({ ...s, minConfidence: v }))}
        />
        <NumField
          label={COPY.settingsMinLiquidity.label}
          hint={COPY.settingsMinLiquidity.hint}
          step={1000}
          value={state.minLiquidityCents}
          onChange={(v) => setState((s) => ({ ...s, minLiquidityCents: v }))}
        />
        <NumField
          label={COPY.settingsMaxSpread.label}
          hint={COPY.settingsMaxSpread.hint}
          step={1}
          max={100}
          value={state.maxSpreadCents}
          onChange={(v) => setState((s) => ({ ...s, maxSpreadCents: v }))}
        />
      </SectionCard>

      <SectionCard
        title="How we score interesting-ness"
        intro="Advanced: controls the 0–100 interest score shown on each market."
      >
        <NumField
          label={COPY.settingsSnapshot.label}
          hint={COPY.settingsSnapshot.hint}
          step={1}
          max={100}
          value={state.snapshotMinOpportunityScore}
          onChange={(v) => setState((s) => ({ ...s, snapshotMinOpportunityScore: v }))}
        />
        <NumField
          label={COPY.settingsAlert.label}
          hint={COPY.settingsAlert.hint}
          step={1}
          max={100}
          value={state.alertMinOpportunityScore}
          onChange={(v) => setState((s) => ({ ...s, alertMinOpportunityScore: v }))}
        />
        <NumField
          label="How much money in the market counts as 'enough' (cents)"
          hint="Markets with more than this much liquidity get full credit; below that the score scales down."
          step={1000}
          value={state.opportunityWeights.liquiditySaturationCents}
          onChange={(v) =>
            setState((s) => ({
              ...s,
              opportunityWeights: { ...s.opportunityWeights, liquiditySaturationCents: v },
            }))
          }
        />
        <NumField
          label="How wide a buy/sell gap starts hurting the score (cents)"
          hint="Larger gaps than this heavily penalize the score."
          step={1}
          max={100}
          value={state.opportunityWeights.spreadPenaltyCents}
          onChange={(v) =>
            setState((s) => ({
              ...s,
              opportunityWeights: { ...s.opportunityWeights, spreadPenaltyCents: v },
            }))
          }
        />
        <NumField
          label="Confidence floor (0 to 1)"
          hint="A small bump added to confidence so very-low-confidence markets aren't completely silenced."
          step={0.05}
          max={1}
          value={state.opportunityWeights.confidenceFloor}
          onChange={(v) =>
            setState((s) => ({
              ...s,
              opportunityWeights: { ...s.opportunityWeights, confidenceFloor: v },
            }))
          }
        />
      </SectionCard>

      <SectionCard
        title="Pretend bankroll"
        intro="Used by the suggested-bet-size table on each market. No real money is ever touched."
      >
        <NumField
          label={COPY.settingsBankroll.label}
          hint={COPY.settingsBankroll.hint}
          step={10_000}
          value={state.defaultBankrollCents}
          onChange={(v) => setState((s) => ({ ...s, defaultBankrollCents: v }))}
        />
        <NumField
          label={COPY.settingsKelly.label}
          hint={COPY.settingsKelly.hint}
          step={0.05}
          max={1}
          value={state.defaultKellyFraction}
          onChange={(v) => setState((s) => ({ ...s, defaultKellyFraction: v }))}
        />
      </SectionCard>

      <SectionCard
        title="How often to check for updates"
        intro="How frequently the dashboard refreshes while it's open."
      >
        <NumField
          label={COPY.settingsMarketRefresh.label}
          hint={COPY.settingsMarketRefresh.hint}
          step={10}
          value={state.marketRefreshSec}
          onChange={(v) => setState((s) => ({ ...s, marketRefreshSec: v }))}
        />
        <NumField
          label={COPY.settingsModelRefresh.label}
          hint={COPY.settingsModelRefresh.hint ?? ""}
          step={30}
          value={state.modelRefreshSec}
          onChange={(v) => setState((s) => ({ ...s, modelRefreshSec: v }))}
        />
        <NumField
          label={COPY.settingsHistoryRetention.label}
          hint={COPY.settingsHistoryRetention.hint}
          value={state.historyRetentionDays}
          onChange={(v) => setState((s) => ({ ...s, historyRetentionDays: v }))}
        />
      </SectionCard>

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        {savedAt ? (
          <span className="text-[11px] text-emerald-400">saved at {savedAt.toLocaleTimeString()}</span>
        ) : null}
        {error ? <span className="text-xs text-red-400">{error}</span> : null}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {intro ? <p className="text-[11px] text-zinc-400">{intro}</p> : null}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function NumField({
  label,
  hint,
  value,
  step = 1,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  step?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1">
        <Label>{label}</Label>
        {hint ? <InfoHint>{hint}</InfoHint> : null}
      </span>
      <Input
        type="number"
        min={0}
        step={step}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
