export const dynamic = 'force-dynamic';
import { headers } from 'next/headers';
import { z } from 'zod';

import { recordAudit } from '@/lib/server/audit';
import { callBridge } from '@/lib/server/edge-bridges';
import { logStructured } from '@/lib/server/logger';
import { evaluateOutboundPolicy } from '@/lib/server/policy';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';
import { createHandler } from '@/app/api/withObservability';

const paramsSchema = z.object({ id: z.string().uuid() });

const actionSchema = z.object({
  action: z.enum(['resend', 'cancel'])
});

export const POST = createHandler('admin_api.notifications.id.action', async (
  request: Request,
  { params }: { params: { id: string } },
  observability,
) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    observability.recordMetric('notifications.supabase_unavailable', 1);
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing.' }, 503);
  }

  const paramsParsed = paramsSchema.safeParse(params);
  if (!paramsParsed.success) {
    return jsonError({ error: 'invalid_notification_id', message: 'Invalid notification ID.' }, 400);
  }
  const notificationId = paramsParsed.data.id;

  let payload: z.infer<typeof actionSchema>;
  try {
    payload = actionSchema.parse(await request.json());
  } catch (error) {
    return zodValidationError(error);
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
    return jsonError({ error: 'not_found', message: 'Notification not found.' }, 404);
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

  if (payload.action === 'cancel') {
    if (data.status === 'sent') {
      return jsonError({ error: 'invalid_status', message: 'Sent notifications cannot be cancelled.' }, 409);
    }

    if (data.status !== 'queued') {
      return jsonError({ error: 'invalid_status', message: 'Only queued notifications can be cancelled.' }, 409);
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
      return jsonError({ error: 'cancel_failed', message: 'Unable to cancel notification.' }, 500);
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

    return jsonOk({ status: 'cancelled' });
  }

  if (!data.msisdn) {
    return jsonError({ error: 'missing_recipient', message: 'Recipient MSISDN is missing; unable to resend.' }, 422);
  }

  if (data.status === 'sent') {
    return jsonOk({ status: 'sent', message: 'Notification already marked as sent.' });
  }

  if (data.status === 'queued') {
    return jsonOk({ status: 'queued', message: 'Notification already queued for delivery.' });
  }

  const policy = await evaluateOutboundPolicy(data.msisdn, {
    observability,
    channel: 'whatsapp',
    context: { notification_id: notificationId },
  });
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
        blockedAt: policy.blockedAt,
      },
    });

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

  const bridgeResult = await callBridge('voucherSend', {
    notificationId,
    msisdn: data.msisdn,
    action: 'resend'
  });

  const integration = bridgeResult.ok
    ? { status: 'ok' as const, target: 'notification_resend' }
    : { status: 'degraded' as const, target: 'notification_resend', message: bridgeResult.message };

  if (!bridgeResult.ok) {
    return jsonError({ error: 'resend_failed', message: bridgeResult.message, integration }, bridgeResult.status ?? 503);
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
    return jsonError({ error: 'resend_update_failed', message: 'Notification queued but status update failed.' }, 500);
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

  return jsonOk({ status: 'queued', integration });
});
 

export const runtime = "nodejs";
