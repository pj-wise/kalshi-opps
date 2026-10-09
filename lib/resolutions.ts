// Resolution handling: when a market settles, update open paper trades.

import { prisma } from "@/lib/prisma";
import { paperTradePnl } from "@/lib/math/probability";

export async function recordResolution(options: {
  ticker: string;
  outcome: "yes" | "no" | "void";
  settlementValue?: number | null;
  closingPriceCents?: number | null;
  source?: string | null;
}) {
  const market = await prisma.market.findUnique({ where: { ticker: options.ticker } });
  if (!market) throw new Error(`unknown ticker: ${options.ticker}`);
  const now = new Date();
  await prisma.resolution.upsert({
    where: { marketId: market.id },
    create: {
      marketId: market.id,
      outcome: options.outcome,
      settlementValue: options.settlementValue ?? null,
      closingPriceCents: options.closingPriceCents ?? null,
      source: options.source ?? null,
    },
    update: {
      outcome: options.outcome,
      settlementValue: options.settlementValue ?? null,
      closingPriceCents: options.closingPriceCents ?? null,
      source: options.source ?? null,
      resolvedAt: now,
    },
  });

  const trades = await prisma.paperTrade.findMany({
    where: { marketId: market.id, status: "open" },
  });
  for (const t of trades) {
    const { pnlCents, roi, correct, resolvedValueCents } = paperTradePnl(
      t.side as "yes" | "no",
      t.entryPriceCents,
      t.contracts,
      options.outcome,
    );
    await prisma.paperTrade.update({
      where: { id: t.id },
      data: {
        status: "resolved",
        resolvedAt: now,
        resolvedValueCents,
        pnlCents,
        roi,
        correct,
        closingPriceCents: options.closingPriceCents ?? null,
      },
    });
  }

  await prisma.market.update({
    where: { id: market.id },
    data: {
      status: "settled",
      settlementValue: options.settlementValue ?? null,
    },
  });
}
