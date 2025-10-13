import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';

export async function GET() {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to load reminder logs.',
      },
      { status: 503 },
    );
  }

  const { data, error } = await adminClient
    .from('baskets_reminder_events')
    .select(`
      id,
      event,
      reason,
      context,
      created_at,
      reminder:reminder_id (
        id,
        reminder_type,
        status,
        blocked_reason,
        member:member_id (
          profiles:user_id ( display_name, msisdn )
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) {
    logStructured({
      event: 'reminder_logs_fetch_failed',
      target: 'baskets_reminder_events',
      status: 'error',
      message: error.message,
    });
    return NextResponse.json(
      {
        error: 'reminder_logs_fetch_failed',
        message: 'Unable to load reminder logs.',
      },
      { status: 500 },
    );
  }

  const logs = (data ?? []).map((row) => {
    const reminder = row.reminder ?? {};
    const memberProfile = reminder?.member?.profiles ?? {};
    return {
      id: row.id,
      event: row.event,
      reason: row.reason ?? null,
      createdAt: row.created_at,
      reminderType: reminder?.reminder_type ?? null,
      reminderStatus: reminder?.status ?? null,
      blockedReason: reminder?.blocked_reason ?? null,
      memberName: memberProfile?.display_name ?? null,
      memberMsisdn: memberProfile?.msisdn ?? null,
    };
  });

  return NextResponse.json({ data: logs });
}

