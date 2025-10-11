import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { recordAudit } from '@/lib/server/audit';
import { logStructured } from '@/lib/server/logger';
import { requireActorId } from '@/lib/server/auth';

const updateSchema = z.object({
  status: z.enum(['pending', 'endorsing', 'approved', 'rejected', 'disbursed', 'closed']).optional(),
  statusReason: z.string().min(1).max(500).nullable().optional(),
  disbursementScheduledAt: z.string().datetime().nullable().optional(),
  disbursedAt: z.string().datetime().nullable().optional(),
  repaymentSchedule: z.array(z.record(z.any())).optional(),
  saccoDecisionNotes: z.string().max(1000).nullable().optional(),
});

type UpdatePayload = z.infer<typeof updateSchema>;

function buildLoanUpdate(input: UpdatePayload, actorId: string) {
  const update: Record<string, unknown> = {};

  if (input.status !== undefined) {
    update.status = input.status;
    if (['approved', 'rejected', 'disbursed', 'closed'].includes(input.status)) {
      update.sacco_decision_by = actorId;
      update.sacco_decision_at = new Date().toISOString();
    }
  }

  if (input.statusReason !== undefined) {
    update.status_reason = input.statusReason;
  }

  if (input.saccoDecisionNotes !== undefined) {
    update.sacco_decision_notes = input.saccoDecisionNotes;
  }

  if (input.disbursementScheduledAt !== undefined) {
    update.disbursement_scheduled_at = input.disbursementScheduledAt;
  }

  if (input.disbursedAt !== undefined) {
    update.disbursed_at = input.disbursedAt;
    if (input.disbursedAt && !update.status) {
      update.status = 'disbursed';
    }
  }

  if (input.repaymentSchedule !== undefined) {
    update.repayment_schedule = input.repaymentSchedule;
  }

  return update;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to update loan.',
      },
      { status: 503 },
    );
  }

  const loanId = params.id;
  if (!loanId) {
    return NextResponse.json(
      { error: 'missing_id', message: 'Loan id is required.' },
      { status: 400 },
    );
  }

  let payload: UpdatePayload;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  if (!Object.keys(payload).length) {
    return NextResponse.json(
      { error: 'empty_update', message: 'Provide at least one field to update.' },
      { status: 400 },
    );
  }

  let actorId: string;
  try {
    actorId = requireActorId();
  } catch (error) {
    return NextResponse.json(
      {
        error: 'unauthorized',
        message: error instanceof Error ? error.message : 'Unauthorized',
      },
      { status: 401 },
    );
  }

  const updatePayload = buildLoanUpdate(payload, actorId);

  try {
    const { data, error } = await adminClient
      .from('sacco_loans')
      .update(updatePayload)
      .eq('id', loanId)
      .select('id, status')
      .single();

    if (error || !data) {
      logStructured({
        event: 'sacco_loan_update_failed',
        target: 'sacco_loans',
        status: 'error',
        message: error?.message ?? 'Unknown error',
        details: { loanId },
      });
      return NextResponse.json(
        {
          error: 'loan_update_failed',
          message: error?.message ?? 'Unable to update loan.',
        },
        { status: error?.code === 'PGRST116' ? 404 : 500 },
      );
    }

    await recordAudit({
      actorId,
      action: 'baskets_loan_update',
      targetTable: 'sacco_loans',
      targetId: loanId,
      diff: updatePayload,
    });

    return NextResponse.json({ success: true, status: data.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown_error');
    if (message.includes('BKT_LTV_EXCEEDED')) {
      return NextResponse.json(
        {
          error: 'ltv_enforced',
          message: 'Loan collateral coverage below required threshold.',
        },
        { status: 409 },
      );
    }
    logStructured({
      event: 'sacco_loan_update_exception',
      target: 'sacco_loans',
      status: 'error',
      message,
      details: { loanId },
    });
    return NextResponse.json(
      {
        error: 'loan_update_failed',
        message,
      },
      { status: 500 },
    );
  }
}
