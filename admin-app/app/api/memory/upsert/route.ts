import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiBase = process.env.BACKEND_API_BASE || process.env.NEXT_PUBLIC_BACKEND_API_BASE;
    const adminToken = process.env.ADMIN_API_TOKEN;
    if (!apiBase || !adminToken) {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
    }
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/realtime/memory/upsert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

