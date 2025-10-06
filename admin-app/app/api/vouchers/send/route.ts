import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { evaluateOutboundPolicy } from '@/lib/server/policy';
import { callBridge } from '@/lib/server/edge-bridges';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';

const requestSchema = z.object({
  voucherId: z.string().uuid(),
  msisdn: z.string().min(5),
  message: z.string().optional()
});

export async function POST(request: Request) {
  let parsed: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    parsed = requestSchema.parse(json);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.'
      },
      { status: 400 }
    );
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase service role not configured. Unable to send vouchers.',
        integration: {
          status: 'degraded' as const,
          target: 'voucher_send',
          message: 'Voucher send bridge unavailable until Supabase credentials are provided.'
        }
      },
      { status: 503 }
    );
  }

  const policy = await evaluateOutboundPolicy(parsed.msisdn);
  if (!policy.allowed) {
    return NextResponse.json(
      {
        error: 'policy_blocked',
        reason: policy.reason,
        message: policy.message ?? 'Send blocked by outbound policy.'
      },
      { status: 409 }
    );
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
    return NextResponse.json(
      { error: 'voucher_lookup_failed', message: 'Unable to load voucher.' },
      { status: 500 }
    );
  }

  if (!voucher) {
    return NextResponse.json(
      { error: 'not_found', message: 'Voucher not found.' },
      { status: 404 }
    );
  }

  if (voucher.status === 'sent') {
    return NextResponse.json(
      {
        status: 'sent',
        message: 'Voucher already marked as sent.'
      },
      { status: 200 }
    );
  }

  const idempotencyKey = headers().get('x-idempotency-key') ?? undefined;
  const actorIdHeader = headers().get('x-actor-id');
  const actorId = actorIdHeader && z.string().uuid().safeParse(actorIdHeader).success ? actorIdHeader : null;

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
    return NextResponse.json(
      {
        error: 'send_failed',
        message: bridgeResult.message,
        integration
      },
      { status: bridgeResult.status ?? 503 }
    );
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
    return NextResponse.json(
      {
        error: 'voucher_update_failed',
        message: 'Voucher send succeeded but status update failed. Manual review required.',
        integration
      },
      { status: 500 }
    );
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

  return NextResponse.json(
    {
      status: 'sent',
      integration
    },
    { status: 200 }
  );
}
