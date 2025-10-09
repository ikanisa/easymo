import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';

const listQuerySchema = z.object({
  status: z.string().optional(),
  saccoId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to fetch loans.',
      },
      { status: 503 },
    );
  }

  let query: z.infer<typeof listQuerySchema>;
  try {
    query = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_query',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid query parameters.',
      },
      { status: 400 },
    );
  }

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 100;
  const rangeEnd = offset + limit - 1;

  const supabaseQuery = adminClient
    .from('sacco_loans')
    .select(
      `id, ikimina_id, member_id, principal, currency, tenure_months, rate_apr,
       purpose, status, status_reason, created_at, updated_at, meta,
       collateral_total, ltv_ratio, disbursement_scheduled_at, disbursed_at,
       repayment_schedule, committee_completed_at, sacco_decision_at,
       sacco_decision_notes, sacco_decision_by,
       ibimina:ikimina_id (id, name, status, sacco_id,
         sacco:sacco_id (id, name, branch_code, ltv_min_ratio)
       ),
       member:member_id (id, status, user_id,
         profile:user_id (display_name, msisdn)
       ),
       collateral:sacco_collateral (id, source, amount_pledged, coverage_ratio, valuation, details)
      `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, rangeEnd);

  if (query.status) supabaseQuery.eq('status', query.status);
  if (query.saccoId) supabaseQuery.eq('ibimina.sacco_id', query.saccoId);
  if (query.search) {
    const term = `%${query.search}%`;
    supabaseQuery.or(`purpose.ilike.${term},member.profile.msisdn.ilike.${term}`);
  }

  const { data, error, count } = await supabaseQuery;

  if (error) {
    logStructured({
      event: 'sacco_loans_fetch_failed',
      target: 'sacco_loans',
      status: 'error',
      message: error.message,
    });
    return NextResponse.json(
      {
        error: 'loans_fetch_failed',
        message: 'Unable to load loans.',
      },
      { status: 500 },
    );
  }

  const rows = data ?? [];
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return NextResponse.json(
    {
      data: rows.map((row) => ({
        id: row.id,
        principal: Number(row.principal ?? 0),
        currency: row.currency,
        tenureMonths: row.tenure_months,
        rateApr: row.rate_apr != null ? Number(row.rate_apr) : null,
        purpose: row.purpose,
        status: row.status,
        statusReason: row.status_reason ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        meta: typeof row.meta === 'object' && row.meta !== null ? row.meta : {},
        collateralTotal: Number(row.collateral_total ?? 0),
        ltvRatio: row.ltv_ratio != null ? Number(row.ltv_ratio) : null,
        disbursementScheduledAt: row.disbursement_scheduled_at,
        disbursedAt: row.disbursed_at,
        repaymentSchedule: Array.isArray(row.repayment_schedule)
          ? row.repayment_schedule
          : [],
        committeeCompletedAt: row.committee_completed_at,
        saccoDecisionAt: row.sacco_decision_at,
        saccoDecisionNotes: row.sacco_decision_notes ?? null,
        saccoDecisionBy: row.sacco_decision_by ?? null,
        ikimina: row.ibimina ? {
          id: row.ibimina.id,
          name: row.ibimina.name,
          status: row.ibimina.status,
          sacco: row.ibimina.sacco ? {
            id: row.ibimina.sacco.id,
            name: row.ibimina.sacco.name,
            branchCode: row.ibimina.sacco.branch_code,
            ltvMinRatio: row.ibimina.sacco.ltv_min_ratio != null
              ? Number(row.ibimina.sacco.ltv_min_ratio)
              : null,
          } : null,
        } : null,
        member: row.member ? {
          id: row.member.id,
          status: row.member.status,
          userId: row.member.user_id,
          profile: row.member.profile ? {
            displayName: row.member.profile.display_name ?? null,
            msisdn: row.member.profile.msisdn ?? null,
          } : null,
        } : null,
        collateral: Array.isArray(row.collateral)
          ? row.collateral.map((item) => ({
            id: item.id,
            source: item.source,
            amount: Number(item.amount_pledged ?? 0),
            coverageRatio: item.coverage_ratio != null
              ? Number(item.coverage_ratio)
              : null,
            valuation: item.valuation != null ? Number(item.valuation) : null,
            details: typeof item.details === 'object' && item.details !== null
              ? item.details
              : {},
          }))
          : [],
      })),
      total,
      hasMore,
    },
    { status: 200 },
  );
}
