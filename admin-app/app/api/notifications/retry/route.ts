export const dynamic = 'force-dynamic';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { evaluateOutboundPolicy } from '@/lib/server/policy';
import { recordAudit } from '@/lib/server/audit';
import { logStructured } from '@/lib/server/logger';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';

const payloadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

export const POST = createHandler('admin_api.notifications.retry', async (request, _context, observability) => {
  const { recordMetric } = observability;
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    recordMetric('notifications.retry.supabase_unavailable', 1);
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to retry notifications.' }, 503);
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await request.json());
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

  const selection = await adminClient
    .from('notifications')
    .select('id, status, msisdn, retry_count, type, to_role')
    .in('id', payload.ids);

  if (selection.error) {
    logStructured({
      event: 'notifications_retry_fetch_failed',
      target: 'notifications',
      status: 'error',
      message: selection.error.message,
    });
    recordMetric('notifications.retry.supabase_error', 1, {
      message: selection.error.message,
    });
    return jsonError({ error: 'fetch_failed', message: 'Unable to load notifications for retry.' }, 500);
  }

  const rows = selection.data ?? [];
  const rowMap = new Map(rows.map((row) => [row.id, row]));

  const queued: string[] = [];
  const blocked: Array<{ id: string; reason: string; message?: string; blockedAt?: string; throttle?: Record<string, unknown> }> = [];
  const missing: string[] = [];

  for (const id of payload.ids) {
    const row = rowMap.get(id);
    if (!row) {
      missing.push(id);
      continue;
    }

    if (row.status === 'queued') {
      blocked.push({ id, reason: 'already_queued', message: 'Notification already queued for delivery.' });
      continue;
    }

    if (row.status === 'sent') {
      blocked.push({ id, reason: 'already_sent', message: 'Notification already marked as sent.' });
      continue;
    }

    if (!row.msisdn) {
      blocked.push({ id, reason: 'missing_msisdn', message: 'Recipient phone number missing.' });
      continue;
    }

    const policy = await evaluateOutboundPolicy(row.msisdn, {
      observability,
      channel: 'whatsapp',
      context: { notification_id: id },
    });
    if (!policy.allowed) {
      blocked.push({
        id,
        reason: policy.reason ?? 'policy_blocked',
        message: policy.message,
        blockedAt: policy.blockedAt,
        throttle: policy.throttle
          ? {
              count: policy.throttle.count,
              limit: policy.throttle.limit,
              windowStart: policy.throttle.windowStart,
              windowEnd: policy.throttle.windowEnd,
            }
          : undefined,
      });
      await recordAudit({
        actorId,
        action: 'notification_retry_blocked',
        targetTable: 'notifications',
        targetId: id,
        diff: {
          status: row.status,
          msisdn: row.msisdn,
          reason: policy.reason ?? 'policy_blocked',
          blockedAt: policy.blockedAt,
        },
      });
      continue;
    }

    const update = await adminClient
      .from('notifications')
      .update({
        status: 'queued',
        error_message: null,
        next_attempt_at: null,
        locked_at: null,
        sent_at: null,
      })
      .eq('id', id);

    if (update.error) {
      blocked.push({ id, reason: 'update_failed', message: update.error.message });
      logStructured({
        event: 'notifications_retry_update_failed',
        target: 'notifications',
        status: 'error',
        message: update.error.message,
        details: { notificationId: id },
      });
      continue;
    }

    queued.push(id);

    await recordAudit({
      actorId,
      action: 'notification_retry',
      targetTable: 'notifications',
      targetId: id,
      diff: {
        status: 'queued',
        retryCount: row.retry_count ?? 0,
      },
    });

    logStructured({
      event: 'notifications_retry_queued',
      target: 'notifications',
      status: 'ok',
      details: {
        notificationId: id,
        type: row.type,
        toRole: row.to_role,
      },
    });
  }

  recordMetric('notifications.retry.processed', payload.ids.length, {
    queued: queued.length,
    blocked: blocked.length,
    missing: missing.length,
  });

  return jsonOk({ queued, blocked, missing });
});
