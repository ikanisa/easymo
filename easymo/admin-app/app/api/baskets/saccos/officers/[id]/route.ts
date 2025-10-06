import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to remove officer.',
      },
      { status: 503 },
    );
  }

  const officerId = params.id;
  if (!officerId) {
    return NextResponse.json(
      { error: 'missing_id', message: 'Officer id is required.' },
      { status: 400 },
    );
  }

  const actorId = headers().get('x-actor-id');

  const { data, error } = await adminClient
    .from('sacco_officers')
    .delete()
    .eq('id', officerId)
    .select('id, sacco_id, user_id, role')
    .single();

  if (error || !data) {
    logStructured({
      event: 'sacco_officer_delete_failed',
      target: 'sacco_officers',
      status: 'error',
      message: error?.message ?? 'Unknown error',
      details: { officerId },
    });
    return NextResponse.json(
      {
        error: 'sacco_officer_delete_failed',
        message: 'Unable to remove SACCO officer.',
      },
      { status: error?.code === 'PGRST116' ? 404 : 500 },
    );
  }

  await recordAudit({
    actorId,
    action: 'sacco_officer_delete',
    targetTable: 'sacco_officers',
    targetId: officerId,
    diff: data,
  });

  return NextResponse.json({ success: true }, { status: 200 });
}

