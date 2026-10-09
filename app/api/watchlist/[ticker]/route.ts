import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { midImpliedProbability } from "@/lib/math/probability";

export async function POST(_req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  const market = await prisma.market.findUnique({
    where: { ticker: decodeURIComponent(ticker) },
    include: {
      estimates: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!market) {
    return NextResponse.json({ error: "unknown ticker" }, { status: 404 });
  }
  const est = market.estimates[0];
  const marketProb = midImpliedProbability(market.lastYesBidCents, market.lastYesAskCents, market.lastPriceCents);
  const item = await prisma.watchlistItem.upsert({
    where: { marketId: market.id },
    create: {
      marketId: market.id,
      addedYesPriceCents: market.lastYesAskCents ?? market.lastPriceCents ?? null,
      addedModelProbability: est?.probability ?? null,
      addedMarketProbability: marketProb,
      addedOpportunityScore: est?.opportunityScore ?? null,
    },
    update: {},
  });
  return NextResponse.json({ ok: true, id: item.id });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  const market = await prisma.market.findUnique({ where: { ticker: decodeURIComponent(ticker) } });
  if (!market) return NextResponse.json({ error: "unknown ticker" }, { status: 404 });
  await prisma.watchlistItem.deleteMany({ where: { marketId: market.id } });
  return NextResponse.json({ ok: true });
}
