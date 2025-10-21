export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/lib/server/audit';

const schema = z.object({
  source: z.string().min(1),
  suggestionId: z.string().optional().nullable(),
  action: z.enum(['apply','dismiss','other']).default('other'),
  actionId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = schema.parse(body);
    await recordAudit({
      actorId: process.env.ADMIN_TEST_ACTOR_ID || null,
      action: `assistant_${payload.action}`,
      targetTable: 'assistant_suggestions',
      targetId: payload.suggestionId || 'n/a',
      diff: { source: payload.source, actionId: payload.actionId, notes: payload.notes },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'bad_request', message: (error as Error).message }, { status: 400 });
  }
}

