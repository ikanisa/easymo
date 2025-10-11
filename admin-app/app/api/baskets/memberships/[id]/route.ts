import { headers } from 'next/headers';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';

const updateSchema = z.object({
  status: z.enum(['pending', 'active', 'removed']),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase credentials missing. Unable to update membership.',
    }, 503);
  }

  const memberId = params.id;
  if (!memberId) {
    return jsonError({ error: 'missing_id', message: 'Membership id is required.' }, 400);
  }

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
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

  const { data, error } = await adminClient
    .from('ibimina_members')
    .update({ status: payload.status })
    .eq('id', memberId)
    .select('id, ikimina_id, user_id, status')
    .single();

  if (error || !data) {
    logStructured({
      event: 'ibimina_member_update_failed',
      target: 'ibimina_members',
      status: 'error',
      message: error?.message ?? 'Unknown error',
      details: { memberId },
    });
    return jsonError({ error: 'ibimina_member_update_failed', message: 'Unable to update membership.' }, error?.code === 'PGRST116' ? 404 : 500);
  }

  await recordAudit({
    actorId,
    action: 'ibimina_member_update',
    targetTable: 'ibimina_members',
    targetId: memberId,
    diff: { status: payload.status },
  });

  return jsonOk({ success: true });
}
