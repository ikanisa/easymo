export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getMarketplaceServiceUrls } from '@/lib/runtime-config';

const getSchema = z.object({ tenantId: z.string().uuid().optional() });
const postSchema = z.object({
  tenantId: z.string().uuid().optional(),
  freeContacts: z.coerce.number().int().min(0).optional(),
  windowDays: z.coerce.number().int().min(1).optional(),
  subscriptionTokens: z.coerce.number().int().min(1).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = getSchema.parse({ tenantId: searchParams.get('tenantId') || undefined });
    const { vendor } = getMarketplaceServiceUrls();
    if (!vendor) return NextResponse.json({ error: 'vendor_service_unavailable' }, { status: 503 });
    const tenantId = payload.tenantId || process.env.AGENT_INTERNAL_TENANT_ID || '';
    if (!tenantId) return NextResponse.json({ error: 'missing_tenant' }, { status: 400 });
    const res = await fetch(`${vendor}/marketplace/settings?tenantId=${tenantId}`);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, data }, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'bad_request', message: (error as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = postSchema.parse(body);
    const { vendor } = getMarketplaceServiceUrls();
    if (!vendor) return NextResponse.json({ error: 'vendor_service_unavailable' }, { status: 503 });
    const tenantId = payload.tenantId || process.env.AGENT_INTERNAL_TENANT_ID || '';
    if (!tenantId) return NextResponse.json({ error: 'missing_tenant' }, { status: 400 });
    const res = await fetch(`${vendor}/marketplace/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, data }, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'bad_request', message: (error as Error).message }, { status: 400 });
  }
}

