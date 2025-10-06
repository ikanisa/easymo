import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { requireActorId } from '@/lib/server/auth';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; collateralId: string } },
) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to remove collateral.',
      },
      { status: 503 },
    );
  }

  const loanId = params.id;
  const collateralId = params.collateralId;
  if (!loanId || !collateralId) {
    return NextResponse.json(
      { error: 'missing_id', message: 'Loan id and collateral id are required.' },
      { status: 400 },
    );
  }

  const { data: row, error: fetchError } = await adminClient
    .from('sacco_collateral')
    .select('id, loan_id')
    .eq('id', collateralId)
    .maybeSingle();

  if (fetchError) {
    logStructured({
      event: 'sacco_collateral_lookup_failed',
      target: 'sacco_collateral',
      status: 'error',
      message: fetchError.message,
      details: { collateralId, loanId },
    });
    return NextResponse.json(
      { error: 'collateral_lookup_failed', message: 'Unable to find collateral.' },
      { status: 500 },
    );
  }

  if (!row || row.loan_id !== loanId) {
    return NextResponse.json(
      { error: 'not_found', message: 'Collateral not found for this loan.' },
      { status: 404 },
    );
  }

  const { error } = await adminClient
    .from('sacco_collateral')
    .delete()
    .eq('id', collateralId);

  if (error) {
    logStructured({
      event: 'sacco_collateral_delete_failed',
      target: 'sacco_collateral',
      status: 'error',
      message: error.message,
      details: { collateralId, loanId },
    });
    return NextResponse.json(
      {
        error: 'collateral_delete_failed',
        message: 'Unable to remove collateral.',
      },
      { status: 500 },
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

  await recordAudit({
    actorId,
    action: 'baskets_collateral_delete',
    targetTable: 'sacco_collateral',
    targetId: collateralId,
    diff: { loanId },
  });

  return NextResponse.json({ success: true });
}
