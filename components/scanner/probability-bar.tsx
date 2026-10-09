// Tiny horizontal bar used across all card variants.  Shows the YES price
// filled with sky blue and the model estimate as a small tick in emerald.

export function ProbabilityBar({
  marketCents,
  modelProb,
  compact = false,
}: {
  marketCents: number | null;
  modelProb: number | null;
  compact?: boolean;
}) {
  const marketPct = marketCents == null ? 0 : Math.max(0, Math.min(100, marketCents));
  const modelPct =
    modelProb == null ? null : Math.max(0, Math.min(100, Math.round(modelProb * 100)));
  const height = compact ? "h-1.5" : "h-2.5";
  return (
    <div className={`relative w-full overflow-hidden rounded-sm bg-zinc-800 ${height}`}>
      <div
        className="h-full bg-sky-500/70 transition-all"
        style={{ width: `${marketPct}%` }}
      />
      {modelPct != null ? (
        <span
          className="absolute top-0 h-full w-[2px] bg-emerald-400"
          style={{ left: `calc(${modelPct}% - 1px)` }}
          title={`our estimate: ${modelPct}%`}
        />
      ) : null}
    </div>
  );
}
