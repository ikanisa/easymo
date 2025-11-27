import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const base = process.env.AGENT_CORE_URL ?? 'http://localhost:4000';
  const body = await req.json();
  const r = await fetch(`${base.replace(/\/$/, '')}/ai/settlement/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-request-id': crypto.randomUUID() },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}


export const runtime = "nodejs";
