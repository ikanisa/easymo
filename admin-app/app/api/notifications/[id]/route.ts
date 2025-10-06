import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { callBridge } from '@/lib/server/edge-bridges';
import { headers } from 'next/headers';

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
    .select('id, msisdn, status')
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

  const actorId = headers().get('x-actor-id');

  if (payload.action === 'cancel') {
    const { error: updateError } = await adminClient
      .from('notifications')
      .update({ status: 'cancelled' })
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

    return NextResponse.json({ status: 'cancelled' }, { status: 200 });
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

  await adminClient
    .from('notifications')
    .update({ status: 'queued', sent_at: null })
    .eq('id', notificationId);

  await recordAudit({
    actorId,
    action: 'notification_resend',
    targetTable: 'notifications',
    targetId: notificationId,
    diff: { status: 'queued' }
  });

  return NextResponse.json({ status: 'queued', integration }, { status: 200 });
}
