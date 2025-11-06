export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAgentCoreUrl } from '@/lib/runtime-config';

const listSchema = z.object({ tenantId: z.string().uuid() });
const createSchema = z.object({ tenantId: z.string().uuid(), name: z.string().min(2), slug: z.string().min(2), persona: z.string().optional() });

function headers() {
  const token = process.env.AGENT_CORE_INTERNAL_TOKEN || process.env.EASYMO_ADMIN_TOKEN || '';
  return { 'x-agent-jwt': token, 'Content-Type': 'application/json' };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = listSchema.parse({ tenantId: searchParams.get('tenantId') });
    const base = getAgentCoreUrl();
    if (!base) return NextResponse.json({ error: 'agent_core_unavailable' }, { status: 503 });
    const res = await fetch(`${base.replace(/\/$/, '')}/admin/agents?tenantId=${payload.tenantId}`, { headers: headers() });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, data }, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'bad_request', message: (error as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = createSchema.parse(await request.json());
    const base = getAgentCoreUrl();
    if (!base) return NextResponse.json({ error: 'agent_core_unavailable' }, { status: 503 });
    const res = await fetch(`${base.replace(/\/$/, '')}/admin/agents`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, data }, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'bad_request', message: (error as Error).message }, { status: 400 });
  }
}


export const runtime = "edge";
