export const dynamic = 'force-dynamic';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';
import { createHandler } from '@/app/api/withObservability';

const paramsSchema = z.object({ id: z.string().uuid() });

const requestSchema = z.object({
  action: z.enum(['cancel', 'nudge', 'reopen']),
  reason: z.string().min(1)
});

export const POST = createHandler('admin_api.orders.override', async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing.' }, 503);
  }

  const parseParams = paramsSchema.safeParse(params);
  if (!parseParams.success) {
    return jsonError({ error: 'invalid_order_id', message: 'Invalid order ID.' }, 400);
  }
  const orderId = parseParams.data.id;

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await request.json());
  } catch (error) {
    return zodValidationError(error);
  }

  let actorId: string;
  try {
    actorId = requireActorId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonError({ error: 'unauthorized', message: err.message }, 401);
    }
    throw err;
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
    return jsonError({ error: 'override_failed', message: 'Unable to apply override.' }, 500);
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
    actorId,
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

  return jsonOk({ status: data.status, message: 'Override applied.' });
});

export const runtime = "edge";
