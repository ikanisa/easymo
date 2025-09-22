import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/lib/server/audit';

const paramsSchema = z.object({
  id: z.string().min(1)
});

const bodySchema = z.object({
  action: z.enum(['resend', 'cancel'])
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { id } = paramsSchema.parse(context.params);
    const { action } = bodySchema.parse(await request.json());
    const { getSupabaseAdminClient } = await import('@/lib/server/supabase-admin');
    const adminClient = getSupabaseAdminClient();
    let message = '';
    let integration: { target: string; status: 'ok' | 'degraded'; reason?: string; message?: string } = {
      target: 'notifications',
      status: 'degraded',
      reason: 'mock_store',
      message: 'Supabase not configured; returning mock acknowledgement.'
    };

    if (adminClient) {
      if (action === 'cancel') {
        const { error } = await adminClient
          .from('notifications')
          .update({ status: 'cancelled' })
          .eq('id', id);
        if (error) {
          console.error('Supabase notification cancel failed', error);
        } else {
          message = 'Notification cancelled.';
          integration = { target: 'notifications', status: 'ok' };
        }
      }
      if (action === 'resend') {
        const { error } = await adminClient
          .from('notifications')
          .update({ status: 'queued', retry_count: (Math.random() * 3) | 0 })
          .eq('id', id);
        if (error) {
          console.error('Supabase notification resend failed', error);
        } else {
          message = 'Notification queued for resend.';
          integration = { target: 'notifications', status: 'ok' };
        }
      }
    }

    if (!message) {
      message = action === 'cancel' ? 'Notification cancelled (mock).' : 'Notification queued (mock).';
    }

    await recordAudit({
      actor: 'admin:mock',
      action: `notification_${action}`,
      targetTable: 'notifications',
      targetId: id,
      summary: message
    });

    return NextResponse.json({ notificationId: id, status: action, message, integration }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_request', details: error.flatten() }, { status: 400 });
    }
    console.error('Notification action failed', error);
    return NextResponse.json({ error: 'notification_action_failed' }, { status: 500 });
  }
}
