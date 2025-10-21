export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAgentCoreUrl } from '@/lib/runtime-config';

const idSchema = z.object({ id: z.string().uuid() });
const createSchema = z.object({ title: z.string().min(1), description: z.string().optional(), payloadSchema: z.any().optional() });

function headers() {
  const token = process.env.AGENT_CORE_INTERNAL_TOKEN || process.env.EASYMO_ADMIN_TOKEN || '';
  return { 'x-agent-jwt': token, 'Content-Type': 'application/json' };
}

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const { id } = idSchema.parse(context.params);
    const base = getAgentCoreUrl();
    if (!base) return NextResponse.json({ error: 'agent_core_unavailable' }, { status: 503 });
    const res = await fetch(`${base.replace(/\/$/, '')}/admin/agents/${id}/tasks`, { headers: headers() });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, data }, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'bad_request', message: (error as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { id } = idSchema.parse(context.params);
    const payload = createSchema.parse(await request.json());
    const base = getAgentCoreUrl();
    if (!base) return NextResponse.json({ error: 'agent_core_unavailable' }, { status: 503 });
    const res = await fetch(`${base.replace(/\/$/, '')}/admin/agents/${id}/tasks`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, data }, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'bad_request', message: (error as Error).message }, { status: 400 });
  }
}

