import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtPct, fmtRelativeTime } from "@/lib/format";

export interface ModelInputRow {
  source: string;
  key: string;
  value: unknown;
  weight: number;
  contribution: number | null;
  timestamp: string;
  freshnessSec: number | null;
}

export function ModelInputsTable({ inputs }: { inputs: ModelInputRow[] }) {
  if (inputs.length === 0) {
    return (
      <div className="text-xs text-zinc-500 py-4">
        Our estimate did not record any specific signals for this market.
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Where it came from</TableHead>
          <TableHead>Signal</TableHead>
          <TableHead>What it said</TableHead>
          <TableHead>How much it mattered</TableHead>
          <TableHead>Contribution</TableHead>
          <TableHead>When we saw it</TableHead>
          <TableHead>Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {inputs.map((inp, i) => (
          <TableRow key={`${inp.source}-${inp.key}-${i}`}>
            <TableCell>
              <span className="font-mono text-[11px] text-zinc-400">{inp.source}</span>
            </TableCell>
            <TableCell>{inp.key}</TableCell>
            <TableCell className="font-tabular text-zinc-300">{formatValue(inp.value)}</TableCell>
            <TableCell className="font-tabular">{fmtPct(inp.weight, 0)}</TableCell>
            <TableCell className="font-tabular">
              {inp.contribution == null ? "—" : inp.contribution.toFixed(3)}
            </TableCell>
            <TableCell className="text-zinc-500">{fmtRelativeTime(inp.timestamp)}</TableCell>
            <TableCell className="text-zinc-500">
              {inp.freshnessSec == null
                ? "—"
                : inp.freshnessSec < 60
                  ? `${inp.freshnessSec}s`
                  : `${Math.round(inp.freshnessSec / 60)}m old`}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") return value.toFixed(3);
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.probability === "number") return `${(obj.probability * 100).toFixed(1)}% chance`;
    if (typeof obj.prior === "number") return `base rate ${(obj.prior * 100).toFixed(0)}%`;
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}
