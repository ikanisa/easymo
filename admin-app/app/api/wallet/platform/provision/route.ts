export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getMarketplaceServiceUrls } from '@/lib/runtime-config';

const schema = z.object({ tenantId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = schema.parse(body);
    const { wallet } = getMarketplaceServiceUrls();
    if (!wallet) return NextResponse.json({ error: 'wallet_service_unavailable' }, { status: 503 });
    const res = await fetch(`${wallet}/wallet/platform/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, data }, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'bad_request', message: (error as Error).message }, { status: 400 });
  }
}

