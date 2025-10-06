import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';

const paramsSchema = z.object({ id: z.string().uuid() });

const requestSchema = z.object({
  action: z.enum(['cancel', 'nudge', 'reopen']),
  reason: z.string().min(1)
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: 'supabase_unavailable', message: 'Supabase credentials missing.' },
      { status: 503 }
    );
  }

  const parseParams = paramsSchema.safeParse(params);
  if (!parseParams.success) {
    return NextResponse.json(
      { error: 'invalid_order_id', message: 'Invalid order ID.' },
      { status: 400 }
    );
  }
  const orderId = parseParams.data.id;

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.'
      },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (payload.action === 'cancel') {
    updates.status = 'cancelled';
  } else if (payload.action === 'reopen') {
    updates.status = 'pending';
  }

  const { data, error } = await adminClient
    .from('orders')
    .update({
      ...(Object.keys(updates).length ? updates : {}),
      override_reason: payload.reason,
      override_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select('id, status')
    .maybeSingle();

  if (error || !data) {
    logStructured({
      event: 'order_override_failed',
      target: 'orders',
      status: 'error',
      message: error?.message ?? 'Order not found',
      details: { orderId }
    });
    return NextResponse.json(
      {
        error: 'override_failed',
        message: 'Unable to apply override.'
      },
      { status: 500 }
    );
  }

  await adminClient.from('order_events').insert({
    order_id: orderId,
    type: `override_${payload.action}`,
    note: payload.reason
  }).catch(() => {
    // Best-effort; log but do not fail the response.
    logStructured({
      event: 'order_event_insert_failed',
      target: 'order_events',
      status: 'degraded',
      message: 'Failed to record override event.',
      details: { orderId }
    });
  });

  await recordAudit({
    actorId: headers().get('x-actor-id'),
    action: `order_override_${payload.action}`,
    targetTable: 'orders',
    targetId: orderId,
    diff: {
      status: data.status,
      reason: payload.reason
    }
  });

  logStructured({
    event: 'order_override',
    target: 'orders',
    status: 'ok',
    details: {
      orderId,
      action: payload.action,
      status: data.status
    }
  });

  return NextResponse.json(
    {
      status: data.status,
      message: 'Override applied.'
    },
    { status: 200 }
  );
}
