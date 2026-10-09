import { NextResponse } from "next/server";

import { readSettings, writeSettings } from "@/lib/settings";

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    const updated = await writeSettings(body);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
