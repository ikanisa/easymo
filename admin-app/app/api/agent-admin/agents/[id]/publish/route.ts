export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAgentCoreUrl } from '@/lib/runtime-config';

const idSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ revisionId: z.string().uuid().optional() });

function headers() {
  const token = process.env.AGENT_CORE_INTERNAL_TOKEN || process.env.EASYMO_ADMIN_TOKEN || '';
  return { 'x-agent-jwt': token, 'Content-Type': 'application/json' };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = idSchema.parse(await context.params);
    const payload = bodySchema.parse(await request.json().catch(() => ({})));
    const base = getAgentCoreUrl();
    if (!base) return NextResponse.json({ error: 'agent_core_unavailable' }, { status: 503 });
    const res = await fetch(`${base.replace(/\/$/, '')}/admin/agents/${id}/publish`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, data }, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: 'bad_request', message: (error as Error).message }, { status: 400 });
  }
}


export const runtime = "nodejs";
