import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { recordAudit } from '@/lib/server/audit';
import { callBridge } from '@/lib/server/edge-bridges';
import { logStructured } from '@/lib/server/logger';
import { evaluateOutboundPolicy } from '@/lib/server/policy';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const paramsSchema = z.object({ id: z.string().uuid() });

const actionSchema = z.object({
  action: z.enum(['resend', 'cancel'])
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

  const paramsParsed = paramsSchema.safeParse(params);
  if (!paramsParsed.success) {
    return NextResponse.json(
      { error: 'invalid_notification_id', message: 'Invalid notification ID.' },
      { status: 400 }
    );
  }
  const notificationId = paramsParsed.data.id;

  let payload: z.infer<typeof actionSchema>;
  try {
    payload = actionSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.'
      },
      { status: 400 }
    );
  }

  const { data, error } = await adminClient
    .from('notifications')
    .select('id, msisdn, status, retry_count, type, to_role')
    .eq('id', notificationId)
    .maybeSingle();

  if (error || !data) {
    logStructured({
      event: 'notification_fetch_failed',
      target: 'notifications',
      status: 'error',
      message: error?.message ?? 'Notification not found',
      details: { notificationId }
    });
    return NextResponse.json(
      { error: 'not_found', message: 'Notification not found.' },
      { status: 404 }
    );
  }

  const actorHeader = headers().get('x-actor-id');
  const actorId = actorHeader && z.string().uuid().safeParse(actorHeader).success
    ? actorHeader
    : null;

  if (payload.action === 'cancel') {
    if (data.status === 'sent') {
      return NextResponse.json(
        { error: 'invalid_status', message: 'Sent notifications cannot be cancelled.' },
        { status: 409 }
      );
    }

    if (data.status !== 'queued') {
      return NextResponse.json(
        {
          error: 'invalid_status',
          message: 'Only queued notifications can be cancelled.',
        },
        { status: 409 }
      );
    }

    const { error: updateError } = await adminClient
      .from('notifications')
      .update({ status: 'cancelled', locked_at: null, next_attempt_at: null })
      .eq('id', notificationId);

    if (updateError) {
      logStructured({
        event: 'notification_cancel_failed',
        target: 'notifications',
        status: 'error',
        message: updateError.message,
        details: { notificationId }
      });
      return NextResponse.json(
        { error: 'cancel_failed', message: 'Unable to cancel notification.' },
        { status: 500 }
      );
    }

    await recordAudit({
      actorId,
      action: 'notification_cancel',
      targetTable: 'notifications',
      targetId: notificationId,
      diff: { status: 'cancelled' }
    });

    logStructured({
      event: 'notification_cancelled',
      target: 'notifications',
      status: 'ok',
      details: { notificationId }
    });

    return NextResponse.json({ status: 'cancelled' }, { status: 200 });
  }

  if (!data.msisdn) {
    return NextResponse.json(
      {
        error: 'missing_recipient',
        message: 'Recipient MSISDN is missing; unable to resend.',
      },
      { status: 422 }
    );
  }

  if (data.status === 'sent') {
    return NextResponse.json(
      {
        status: 'sent',
        message: 'Notification already marked as sent.',
      },
      { status: 200 }
    );
  }

  if (data.status === 'queued') {
    return NextResponse.json(
      {
        status: 'queued',
        message: 'Notification already queued for delivery.',
      },
      { status: 200 }
    );
  }

  const policy = await evaluateOutboundPolicy(data.msisdn);
  if (!policy.allowed) {
    await recordAudit({
      actorId,
      action: 'outbound_policy_check',
      targetTable: 'notifications',
      targetId: notificationId,
      diff: {
        allowed: false,
        reason: policy.reason ?? 'unknown',
        msisdn: data.msisdn,
      },
    });

    return NextResponse.json(
      {
        error: 'policy_blocked',
        reason: policy.reason,
        message: policy.message ?? 'Send blocked by outbound policy.',
      },
      { status: 409 }
    );
  }

  const bridgeResult = await callBridge('voucherSend', {
    notificationId,
    msisdn: data.msisdn,
    action: 'resend'
  });

  const integration = bridgeResult.ok
    ? { status: 'ok' as const, target: 'notification_resend' }
    : { status: 'degraded' as const, target: 'notification_resend', message: bridgeResult.message };

  if (!bridgeResult.ok) {
    return NextResponse.json(
      { error: 'resend_failed', message: bridgeResult.message, integration },
      { status: bridgeResult.status ?? 503 }
    );
  }

  const { error: resendUpdateError } = await adminClient
    .from('notifications')
    .update({
      status: 'queued',
      sent_at: null,
      error_message: null,
      retry_count: 0,
      next_attempt_at: null,
      locked_at: null,
    })
    .eq('id', notificationId);

  if (resendUpdateError) {
    logStructured({
      event: 'notification_resend_update_failed',
      target: 'notifications',
      status: 'error',
      message: resendUpdateError.message,
      details: { notificationId }
    });
    return NextResponse.json(
      { error: 'resend_update_failed', message: 'Notification queued but status update failed.' },
      { status: 500 }
    );
  }

  await recordAudit({
    actorId,
    action: 'notification_resend',
    targetTable: 'notifications',
    targetId: notificationId,
    diff: {
      status: 'queued',
      retryCount: 0,
      policy: 'allowed'
    }
  });

  logStructured({
    event: 'notification_resend_queued',
    target: 'notifications',
    status: 'ok',
    details: {
      notificationId,
      toRole: data.to_role,
      template: data.type,
    }
  });

  return NextResponse.json({ status: 'queued', integration }, { status: 200 });
}
