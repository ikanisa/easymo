export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getMarketplaceServiceUrls } from '@/lib/runtime-config';

const schema = z.object({
  tenantId: z.string().uuid().optional(),
  vendorId: z.string().uuid(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const vendorId = String(searchParams.get('vendorId'));
    const payload = schema.parse({ tenantId: tenantId ?? undefined, vendorId });
    const { vendor } = getMarketplaceServiceUrls();
    if (!vendor) return NextResponse.json({ error: 'vendor_service_unavailable' }, { status: 503 });
    const resolvedTenantId = payload.tenantId || process.env.AGENT_INTERNAL_TENANT_ID || '';
    if (!resolvedTenantId) return NextResponse.json({ error: 'missing_tenant', message: 'tenantId missing and AGENT_INTERNAL_TENANT_ID not set' }, { status: 400 });
    const res = await fetch(`${vendor}/vendors/${payload.vendorId}/entitlements?tenantId=${resolvedTenantId}`);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, data }, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'bad_request', message: (error as Error).message }, { status: 400 });
  }
}

export const runtime = "edge";
