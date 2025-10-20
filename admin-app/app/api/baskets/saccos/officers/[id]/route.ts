export const dynamic = 'force-dynamic';
import { headers } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { jsonOk, jsonError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase credentials missing. Unable to remove officer.',
    }, 503);
  }

  const officerId = params.id;
  if (!officerId) {
    return jsonError({ error: 'missing_id', message: 'Officer id is required.' }, 400);
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
    return jsonError({ error: 'sacco_officer_delete_failed', message: 'Unable to remove SACCO officer.' }, error?.code === 'PGRST116' ? 404 : 500);
  }

  await recordAudit({
    actorId,
    action: 'sacco_officer_delete',
    targetTable: 'sacco_officers',
    targetId: officerId,
    diff: data,
  });

  return jsonOk({ success: true });
}
