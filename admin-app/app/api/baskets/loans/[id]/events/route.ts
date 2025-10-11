import { jsonOk, jsonError } from '@/lib/api/http';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to fetch loan events.' }, 503);
  }

  const loanId = params.id;
  if (!loanId) {
    return jsonError({ error: 'missing_id', message: 'Loan id is required.' }, 400);
  }

  const { data, error } = await adminClient
    .from('sacco_loan_events')
    .select('id, from_status, to_status, actor_id, actor_role, notes, context, created_at')
    .eq('loan_id', loanId)
    .order('created_at', { ascending: true });

  if (error) {
    logStructured({
      event: 'sacco_loan_events_fetch_failed',
      target: 'sacco_loan_events',
      status: 'error',
      message: error.message,
      details: { loanId },
    });
    return jsonError({ error: 'loan_events_fetch_failed', message: 'Unable to load loan timeline.' }, 500);
  }

  const events = (data ?? []).map((row) => ({
    id: row.id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    notes: row.notes ?? null,
    context: typeof row.context === 'object' && row.context !== null ? row.context : {},
    createdAt: row.created_at,
  }));

  return jsonOk({ data: events });
}
