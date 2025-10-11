import { headers } from 'next/headers';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';

const updateSchema = z.object({
  status: z.enum(['open', 'resolved']).optional(),
  reason: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase credentials missing. Unable to update unmatched SMS.',
    }, 503);
  }

  const unmatchedId = params.id;
  if (!unmatchedId) {
    return jsonError({ error: 'missing_id', message: 'Unmatched id is required.' }, 400);
  }

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    return zodValidationError(error);
  }

  if (!Object.keys(payload).length) {
    return jsonError({ error: 'empty_update', message: 'Provide at least one field to update.' }, 400);
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
    .from('momo_unmatched')
    .update({
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
    })
    .eq('id', unmatchedId)
    .select('id, status, reason')
    .single();

  if (error || !data) {
    logStructured({
      event: 'momo_unmatched_update_failed',
      target: 'momo_unmatched',
      status: 'error',
      message: error?.message ?? 'Unknown error',
      details: { unmatchedId },
    });
    return jsonError({ error: 'momo_unmatched_update_failed', message: 'Unable to update unmatched SMS.' }, error?.code === 'PGRST116' ? 404 : 500);
  }

  await recordAudit({
    actorId,
    action: 'momo_unmatched_update',
    targetTable: 'momo_unmatched',
    targetId: unmatchedId,
    diff: {
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
    },
  });

  return jsonOk({ success: true });
}
