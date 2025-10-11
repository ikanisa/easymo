import { headers } from 'next/headers';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';

const updateSchema = z.object({
  status: z.enum(['pending', 'verified', 'rejected']),
  notes: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase credentials missing. Unable to update KYC document.',
    }, 503);
  }

  const docId = params.id;
  if (!docId) {
    return jsonError({ error: 'missing_id', message: 'KYC document id is required.' }, 400);
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
    .from('kyc_documents')
    .update({
      status: payload.status,
      reviewed_at: new Date().toISOString(),
      parsed_json: payload.notes ? { ...payload, notes: payload.notes } : undefined,
    })
    .eq('id', docId)
    .select('id, status, user_id')
    .single();

  if (error || !data) {
    logStructured({
      event: 'kyc_update_failed',
      target: 'kyc_documents',
      status: 'error',
      message: error?.message ?? 'Unknown error',
      details: { docId },
    });
    return jsonError({ error: 'kyc_update_failed', message: 'Unable to update KYC document.' }, error?.code === 'PGRST116' ? 404 : 500);
  }

  await recordAudit({
    actorId,
    action: 'kyc_update',
    targetTable: 'kyc_documents',
    targetId: docId,
    diff: { status: payload.status, notes: payload.notes ?? null },
  });

  return jsonOk({ success: true });
}
