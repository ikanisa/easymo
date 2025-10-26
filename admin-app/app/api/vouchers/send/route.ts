export const dynamic = 'force-dynamic';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { evaluateOutboundPolicy } from '@/lib/server/policy';
import { callBridge } from '@/lib/server/edge-bridges';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { createHandler } from '@/app/api/withObservability';

const requestSchema = z.object({
  voucherId: z.string().uuid(),
  msisdn: z.string().min(5),
  message: z.string().optional()
});

export const POST = createHandler('admin_api.vouchers.send', async (request: Request, _context, observability) => {
  let parsed: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    parsed = requestSchema.parse(json);
  } catch (error) {
    return zodValidationError(error);
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    observability.recordMetric('vouchers.supabase_unavailable', 1);
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase service role not configured. Unable to send vouchers.',
      integration: {
        status: 'degraded' as const,
        target: 'voucher_send',
        message: 'Voucher send bridge unavailable until Supabase credentials are provided.'
      }
    }, 503);
  }

  const policy = await evaluateOutboundPolicy(parsed.msisdn, {
    observability,
    channel: 'whatsapp',
    context: { voucher_id: parsed.voucherId },
  });
  if (!policy.allowed) {
    return jsonError({
      error: 'policy_blocked',
      reason: policy.reason,
      message: policy.message ?? 'Send blocked by outbound policy.',
      blockedAt: policy.blockedAt,
      throttle: policy.throttle ? {
        count: policy.throttle.count,
        limit: policy.throttle.limit,
        windowStart: policy.throttle.windowStart,
        windowEnd: policy.throttle.windowEnd,
      } : undefined,
    }, 409);
  }

  const { data: voucher, error: voucherError } = await adminClient
    .from('vouchers')
    .select('id, status, campaign_id, station_scope, metadata')
    .eq('id', parsed.voucherId)
    .maybeSingle();

  if (voucherError) {
    logStructured({
      event: 'voucher_fetch_failed',
      target: 'vouchers',
      status: 'error',
      message: voucherError.message,
      details: { voucherId: parsed.voucherId }
    });
    return jsonError({ error: 'voucher_lookup_failed', message: 'Unable to load voucher.' }, 500);
  }

  if (!voucher) {
    return jsonError({ error: 'not_found', message: 'Voucher not found.' }, 404);
  }

  if (voucher.status === 'sent') {
    return jsonOk({ status: 'sent', message: 'Voucher already marked as sent.' });
  }

  const idempotencyKey = headers().get('x-idempotency-key') ?? undefined;
  let actorId: string;
  try {
    actorId = requireActorId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonError({ error: 'unauthorized', message: err.message }, 401);
    }
    throw err;
  }

  const bridgeResult = await callBridge<{ messageId?: string }>('voucherSend', {
    voucherId: parsed.voucherId,
    msisdn: parsed.msisdn,
    message: parsed.message
  }, { idempotencyKey });

  const integration = bridgeResult.ok
    ? { status: 'ok' as const, target: 'voucher_send', details: bridgeResult.data ?? {} }
    : {
        status: 'degraded' as const,
        target: 'voucher_send',
        message: bridgeResult.message
      };

  if (!bridgeResult.ok) {
    return jsonError({ error: 'send_failed', message: bridgeResult.message, integration }, bridgeResult.status ?? 503);
  }

  const updateResult = await adminClient
    .from('vouchers')
    .update({ status: 'sent' })
    .eq('id', parsed.voucherId)
    .select('id')
    .maybeSingle();

  if (updateResult.error) {
    logStructured({
      event: 'voucher_update_failed',
      target: 'vouchers',
      status: 'error',
      message: updateResult.error.message,
      details: { voucherId: parsed.voucherId }
    });
    return jsonError({ error: 'voucher_update_failed', message: 'Voucher send succeeded but status update failed. Manual review required.', integration }, 500);
  }

  await adminClient.from('voucher_events').insert({
    voucher_id: parsed.voucherId,
    event_type: 'sent',
    actor_id: actorId,
    station_id: voucher.station_scope,
    context: {
      msisdn: parsed.msisdn,
      messageId: bridgeResult.data?.messageId ?? null
    }
  });

  await recordAudit({
    actorId,
    action: 'voucher_send',
    targetTable: 'vouchers',
    targetId: parsed.voucherId,
    diff: {
      msisdn: parsed.msisdn,
      messageId: bridgeResult.data?.messageId ?? null
    }
  });

  logStructured({
    event: 'voucher_send',
    target: 'vouchers',
    status: 'ok',
    message: 'Voucher dispatched via bridge.',
    details: {
      voucherId: parsed.voucherId,
      msisdn: parsed.msisdn
    }
  });

  return jsonOk({ status: 'sent', integration });
});
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';
