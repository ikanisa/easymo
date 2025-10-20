export const dynamic = 'force-dynamic';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';

const allocateSchema = z.object({
  memberId: z.string().uuid(),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase credentials missing. Unable to allocate SMS.',
    }, 503);
  }

  const unmatchedId = params.id;
  if (!unmatchedId) {
    return jsonError({ error: 'missing_id', message: 'Unmatched id is required.' }, 400);
  }

  let payload: z.infer<typeof allocateSchema>;
  try {
    payload = allocateSchema.parse(await request.json());
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

  const { data: unmatched, error: unmatchedError } = await adminClient
    .from('momo_unmatched')
    .select(
      `id, status, parsed_id, reason,
       momo_parsed_txns:parsed_id (id, amount, currency, txn_id, txn_ts, msisdn_e164, sender_name),
       ibimina_members:linked_member_id (id)`
    )
    .eq('id', unmatchedId)
    .single();

  if (unmatchedError || !unmatched) {
    return jsonError({ error: 'unmatched_not_found', message: 'Unmatched SMS not found.' }, unmatchedError?.code === 'PGRST116' ? 404 : 500);
  }

  if (!unmatched.momo_parsed_txns) {
    return jsonError({ error: 'missing_parsed_txn', message: 'Unable to allocate. Parsed transaction not available.' }, 409);
  }

  const parsed = Array.isArray(unmatched.momo_parsed_txns)
    ? unmatched.momo_parsed_txns[0]
    : unmatched.momo_parsed_txns;
  if (!parsed) {
    return jsonError({ error: 'missing_parsed_txn', message: 'Unable to allocate. Parsed transaction not available.' }, 409);
  }
  const amount = parsed.amount ?? 0;
  if (!amount) {
    return jsonError({ error: 'missing_amount', message: 'Parsed transaction lacks an amount.' }, 409);
  }

  const txnId = parsed.txn_id ?? `unmatched-${unmatched.id}`;
  const cycle = parsed.txn_ts ? new Date(parsed.txn_ts) : new Date();
  const cycleLabel = `${cycle.getUTCFullYear()}${String(cycle.getUTCMonth() + 1).padStart(2, '0')}`;

  const insertResult = await adminClient
    .from('contributions_ledger')
    .insert({
      ikimina_id: await getIkiminaId(adminClient, payload.memberId),
      member_id: payload.memberId,
      amount,
      currency: parsed.currency ?? 'RWF',
      cycle_yyyymm: cycleLabel,
      txn_id: txnId,
      source: 'sms',
      meta: {
        unmatched_id: unmatched.id,
        msisdn_e164: parsed.msisdn_e164,
        sender_name: parsed.sender_name,
      },
    })
    .select('id, ikimina_id, member_id')
    .maybeSingle();

  if (insertResult.error && !insertResult.data) {
    const err = insertResult.error;
    logStructured({
      event: 'unmatched_allocate_failed',
      target: 'contributions_ledger',
      status: 'error',
      message: err?.message ?? 'Unknown error',
    });
    return jsonError({ error: 'ledger_insert_failed', message: err?.message ?? 'Unable to allocate contribution.' }, 500);
  }

  const ledgerId = insertResult.data?.id ?? null;

  const { error: updateError } = await adminClient
    .from('momo_unmatched')
    .update({
      status: 'resolved',
      linked_member_id: payload.memberId,
      resolved_at: new Date().toISOString(),
      resolved_by: actorId ?? null,
      resolution_notes: payload.notes ?? null,
      allocation_ledger_id: ledgerId,
    })
    .eq('id', unmatched.id);

  if (updateError) {
    logStructured({
      event: 'unmatched_update_failed',
      target: 'momo_unmatched',
      status: 'error',
      message: updateError.message,
    });
    return jsonError({ error: 'unmatched_update_failed', message: 'Unable to update unmatched record.' }, 500);
  }

  await recordAudit({
    actorId,
    action: 'momo_unmatched_allocate',
    targetTable: 'momo_unmatched',
    targetId: unmatched.id,
    diff: {
      linked_member_id: payload.memberId,
      allocation_ledger_id: ledgerId,
      notes: payload.notes ?? null,
    },
  });

  return jsonOk({ success: true, ledgerId });
}

async function getIkiminaId(adminClient: any, memberId: string) {
  const { data, error } = await adminClient
    .from('ibimina_members')
    .select('ikimina_id')
    .eq('id', memberId)
    .single();
  if (error || !data) {
    throw new Error('Membership not found for allocation');
  }
  return data.ikimina_id as string;
}
