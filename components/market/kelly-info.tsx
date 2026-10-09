import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fullKellyFraction, kellyStakeCents } from "@/lib/math/probability";
import { fmtCents, fmtPct } from "@/lib/format";

export function KellyInfo({
  side,
  modelProbability,
  askCents,
  bankrollCents,
}: {
  side: "yes" | "no";
  modelProbability: number | null;
  askCents: number | null;
  bankrollCents: number;
}) {
  if (modelProbability == null || askCents == null) {
    return (
      <div className="text-xs text-zinc-500 py-2">
        We cannot suggest a size until we have an estimate and a price.
      </div>
    );
  }
  const full = fullKellyFraction(side, modelProbability, askCents);
  const rows = [
    { label: "Full Kelly (aggressive)", frac: full },
    { label: "1/2 Kelly (medium)", frac: full * 0.5 },
    { label: "1/4 Kelly (conservative — default)", frac: full * 0.25 },
  ];
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Style</TableHead>
          <TableHead>% of bankroll</TableHead>
          <TableHead>Dollar amount</TableHead>
          <TableHead>Contracts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const stake = kellyStakeCents(side, modelProbability, askCents, bankrollCents, r.frac / full || 0);
          const contracts = askCents > 0 ? Math.floor(stake / askCents) : 0;
          return (
            <TableRow key={r.label}>
              <TableCell>{r.label}</TableCell>
              <TableCell className="font-tabular">{fmtPct(r.frac, 2)}</TableCell>
              <TableCell className="font-tabular">{fmtCents(stake)}</TableCell>
              <TableCell className="font-tabular">{contracts}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
      <tfoot>
        <TableRow>
          <TableCell colSpan={4} className="text-[11px] text-zinc-500">
            For information only. Based on a pretend bankroll of {fmtCents(bankrollCents)}.
          </TableCell>
        </TableRow>
      </tfoot>
    </Table>
  );
}
