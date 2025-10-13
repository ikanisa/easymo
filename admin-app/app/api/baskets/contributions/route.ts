import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';

const listQuerySchema = z.object({
  ikiminaId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  saccoId: z.string().uuid().optional(),
  cycle: z.string().optional(),
  source: z.string().optional(),
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
        message: 'Supabase credentials missing. Unable to fetch ledger.',
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
    .from('contributions_ledger')
    .select(
      `id, amount, currency, cycle_yyyymm, allocated_at, source, txn_id, meta,
       ibimina:ikimina_id (
         id,
         name,
         status,
         sacco_id,
         sacco:sacco_id (id, name, branch_code)
       ),
       member:member_id (
         id,
         status,
         user_id,
         profile:user_id (user_id, display_name, msisdn)
       )`,
      { count: 'exact' },
    )
    .order('allocated_at', { ascending: false })
    .range(offset, rangeEnd);

  if (query.ikiminaId) supabaseQuery.eq('ikimina_id', query.ikiminaId);
  if (query.memberId) supabaseQuery.eq('member_id', query.memberId);
  if (query.saccoId) supabaseQuery.eq('ibimina.sacco_id', query.saccoId);
  if (query.cycle) supabaseQuery.eq('cycle_yyyymm', query.cycle);
  if (query.source) supabaseQuery.eq('source', query.source);
  if (query.search) {
    const term = `%${query.search}%`;
    supabaseQuery.or(`txn_id.ilike.${term},member.profile.msisdn.ilike.${term}`);
  }

  const { data, error, count } = await supabaseQuery;

  if (error) {
    logStructured({
      event: 'contributions_fetch_failed',
      target: 'contributions_ledger',
      status: 'error',
      message: error.message,
    });
    return NextResponse.json(
      {
        error: 'contributions_fetch_failed',
        message: 'Unable to load contributions ledger.',
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
        amount: row.amount,
        currency: row.currency,
        cycle: row.cycle_yyyymm,
        allocatedAt: row.allocated_at,
        source: row.source,
        txnId: row.txn_id,
        meta: row.meta ?? {},
        ikimina: row.ibimina ? {
          id: row.ibimina.id,
          name: row.ibimina.name,
          status: row.ibimina.status,
          sacco: row.ibimina.sacco ? {
            id: row.ibimina.sacco.id,
            name: row.ibimina.sacco.name,
            branchCode: row.ibimina.sacco.branch_code,
          } : null,
        } : null,
        member: row.member ? {
          id: row.member.id,
          status: row.member.status,
          userId: row.member.user_id,
          profile: row.member.profile ? {
            userId: row.member.profile.user_id,
            displayName: row.member.profile.display_name ?? null,
            msisdn: row.member.profile.msisdn ?? null,
          } : null,
        } : null,
      })),
      total,
      hasMore,
    },
    { status: 200 },
  );
}

