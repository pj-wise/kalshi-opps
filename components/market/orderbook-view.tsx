import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface OrderbookRow {
  priceCents: number;
  quantity: number;
}

export function OrderbookView({
  yesBids,
  yesAsks,
}: {
  yesBids: OrderbookRow[];
  yesAsks: OrderbookRow[];
}) {
  const rows = Math.max(5, Math.min(10, Math.max(yesBids.length, yesAsks.length)));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">Buyers want this many</TableHead>
          <TableHead className="text-right">YES buy price</TableHead>
          <TableHead className="text-left">YES sell price</TableHead>
          <TableHead className="text-left">Sellers want this many</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, i) => {
          const bid = yesBids[i];
          const ask = yesAsks[i];
          return (
            <TableRow key={i}>
              <TableCell className="text-right text-zinc-400">{bid?.quantity ?? "—"}</TableCell>
              <TableCell className="text-right text-emerald-400 font-tabular">
                {bid ? `${bid.priceCents}¢` : "—"}
              </TableCell>
              <TableCell className="text-left text-red-400 font-tabular">
                {ask ? `${ask.priceCents}¢` : "—"}
              </TableCell>
              <TableCell className="text-left text-zinc-400">{ask?.quantity ?? "—"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
