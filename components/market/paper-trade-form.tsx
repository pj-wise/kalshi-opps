"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PaperTradeForm({
  ticker,
  yesAskCents,
  noAskCents,
  modelProbability,
  marketProbability,
  confidence,
  opportunityScore,
  estimateId,
  modelId,
  modelVersion,
}: {
  ticker: string;
  yesAskCents: number | null;
  noAskCents: number | null;
  modelProbability: number | null;
  marketProbability: number | null;
  confidence: number | null;
  opportunityScore: number | null;
  estimateId: string | null;
  modelId: string | null;
  modelVersion: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [side, setSide] = React.useState<"yes" | "no">("yes");
  const [price, setPrice] = React.useState<number | "">(yesAskCents ?? 50);
  const [contracts, setContracts] = React.useState<number | "">(10);
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const chooseSide = React.useCallback(
    (next: "yes" | "no") => {
      setSide(next);
      setPrice(next === "yes" ? yesAskCents ?? 50 : noAskCents ?? 50);
    },
    [yesAskCents, noAskCents],
  );

  const submit = React.useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/paper-trades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticker,
          side,
          entryPriceCents: Number(price),
          contracts: Number(contracts),
          notes: notes || null,
          modelProbability,
          marketProbability,
          confidence,
          opportunityScore,
          estimateId,
          modelId,
          modelVersion,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${res.status})`);
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [ticker, side, price, contracts, notes, modelProbability, marketProbability, confidence, opportunityScore, estimateId, modelId, modelVersion, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          Record pretend bet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pretend bet — {ticker}</DialogTitle>
          <DialogDescription>
            This logs a hypothetical bet along with everything we knew at this moment, so later we can
            check how well our estimate did. No real money is ever moved.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 col-span-2">
            <Label>Which side are you betting?</Label>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={side === "yes" ? "primary" : "outline"}
                onClick={() => chooseSide("yes")}
              >
                YES at {yesAskCents ?? "?"}¢ per contract
              </Button>
              <Button
                size="sm"
                variant={side === "no" ? "primary" : "outline"}
                onClick={() => chooseSide("no")}
              >
                NO at {noAskCents ?? "?"}¢ per contract
              </Button>
            </div>
            <span className="text-[11px] text-zinc-500">
              Each contract pays 100¢ if you&apos;re right, 0¢ if you&apos;re wrong.
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Price you&apos;d pay (in cents)</Label>
            <Input
              type="number"
              min={1}
              max={99}
              value={price}
              onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>How many contracts</Label>
            <Input
              type="number"
              min={1}
              value={contracts}
              onChange={(e) => setContracts(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="why are you taking this bet?" />
          </div>
        </div>
        {error ? <div className="text-xs text-red-400">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={submitting || !price || !contracts}
          >
            {submitting ? "Saving…" : "Save pretend bet"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
