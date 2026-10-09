import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const schema = z.object({
  ticker: z.string(),
  side: z.enum(["yes", "no"]),
  entryPriceCents: z.number().int().min(1).max(99),
  contracts: z.number().int().min(1).max(100_000),
  notes: z.string().nullable().optional(),
  modelProbability: z.number().min(0).max(1).nullable().optional(),
  marketProbability: z.number().min(0).max(1).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  opportunityScore: z.number().min(0).max(100).nullable().optional(),
  estimateId: z.string().nullable().optional(),
  modelId: z.string().nullable().optional(),
  modelVersion: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const market = await prisma.market.findUnique({ where: { ticker: data.ticker } });
  if (!market) {
    return NextResponse.json({ error: "unknown ticker" }, { status: 404 });
  }
  const trade = await prisma.paperTrade.create({
    data: {
      marketId: market.id,
      side: data.side,
      entryPriceCents: data.entryPriceCents,
      contracts: data.contracts,
      notes: data.notes ?? null,
      modelProbability: data.modelProbability ?? null,
      marketProbability: data.marketProbability ?? null,
      confidence: data.confidence ?? null,
      opportunityScore: data.opportunityScore ?? null,
      estimateId: data.estimateId ?? null,
      modelId: data.modelId ?? null,
      modelVersion: data.modelVersion ?? null,
      status: "open",
    },
  });
  return NextResponse.json({ ok: true, id: trade.id });
}

export async function GET() {
  const trades = await prisma.paperTrade.findMany({
    orderBy: { createdAt: "desc" },
    include: { market: true },
    take: 500,
  });
  return NextResponse.json({ trades });
}
