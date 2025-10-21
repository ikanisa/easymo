export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getMarketplaceServiceUrls } from '@/lib/runtime-config';

const schema = z.object({ amount: z.coerce.number().positive(), currency: z.string().min(3) });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = schema.parse({ amount: searchParams.get('amount'), currency: searchParams.get('currency') });
    const { wallet } = getMarketplaceServiceUrls();
    if (!wallet) return NextResponse.json({ error: 'wallet_service_unavailable' }, { status: 503 });
    const res = await fetch(`${wallet}/fx/convert?amount=${encodeURIComponent(String(payload.amount))}&currency=${encodeURIComponent(payload.currency)}`);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, data }, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'bad_request', message: (error as Error).message }, { status: 400 });
  }
}

