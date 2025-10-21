export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getMarketplaceServiceUrls } from '@/lib/runtime-config';

const schema = z.object({
  tenantId: z.string().uuid(),
  vendorId: z.string().uuid(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = String(searchParams.get('tenantId'));
    const vendorId = String(searchParams.get('vendorId'));
    const payload = schema.parse({ tenantId, vendorId });
    const { vendor } = getMarketplaceServiceUrls();
    if (!vendor) return NextResponse.json({ error: 'vendor_service_unavailable' }, { status: 503 });
    const res = await fetch(`${vendor}/vendors/${payload.vendorId}/entitlements?tenantId=${payload.tenantId}`);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, data }, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'bad_request', message: (error as Error).message }, { status: 400 });
  }
}

