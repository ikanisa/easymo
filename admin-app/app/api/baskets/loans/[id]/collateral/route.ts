export const dynamic = 'force-dynamic';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { requireActorId } from '@/lib/server/auth';

const createSchema = z.object({
  source: z.enum(['group_savings', 'member_savings', 'guarantor', 'asset']).default('group_savings'),
  amount: z.coerce.number().positive(),
  coverageRatio: z.coerce.number().nonnegative().optional(),
  valuation: z.coerce.number().nonnegative().optional(),
  details: z.record(z.any()).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to add collateral.' }, 503);
  }

  const loanId = params.id;
  if (!loanId) {
    return jsonError({ error: 'missing_id', message: 'Loan id is required.' }, 400);
  }

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch (error) {
    return zodValidationError(error);
  }

  const { data: loanExists, error: loanError } = await adminClient
    .from('sacco_loans')
    .select('id, ikimina_id')
    .eq('id', loanId)
    .maybeSingle();

  if (loanError) {
    logStructured({
      event: 'sacco_loan_lookup_failed',
      target: 'sacco_loans',
      status: 'error',
      message: loanError.message,
      details: { loanId },
    });
    return jsonError({ error: 'loan_lookup_failed', message: 'Unable to find loan.' }, 500);
  }

  if (!loanExists) {
    return jsonError({ error: 'not_found', message: 'Loan not found.' }, 404);
  }

  const insertPayload: Record<string, unknown> = {
    loan_id: loanId,
    source: payload.source,
    amount_pledged: payload.amount,
    coverage_ratio: payload.coverageRatio ?? null,
    valuation: payload.valuation ?? null,
    details: payload.details ?? {},
  };

  let actorId: string;
  try {
    actorId = requireActorId();
  } catch (error) {
    return jsonError({ error: 'unauthorized', message: error instanceof Error ? error.message : 'Unauthorized' }, 401);
  }

  const { data, error } = await adminClient
    .from('sacco_collateral')
    .insert(insertPayload)
    .select('id, source, amount_pledged, coverage_ratio, valuation, details')
    .single();

  if (error || !data) {
    logStructured({
      event: 'sacco_collateral_insert_failed',
      target: 'sacco_collateral',
      status: 'error',
      message: error?.message ?? 'Unknown error',
      details: { loanId },
    });
    return jsonError({ error: 'collateral_insert_failed', message: error?.message ?? 'Unable to add collateral.' }, 500);
  }

  await recordAudit({
    actorId,
    action: 'baskets_collateral_create',
    targetTable: 'sacco_collateral',
    targetId: data.id,
    diff: insertPayload,
  });

  return jsonOk({
    id: data.id,
    source: data.source,
    amount: Number(data.amount_pledged ?? 0),
    coverageRatio: data.coverage_ratio != null ? Number(data.coverage_ratio) : null,
    valuation: data.valuation != null ? Number(data.valuation) : null,
    details: typeof data.details === 'object' && data.details !== null ? data.details : {},
  });
}
