import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { mockStaffNumbers } from '@/lib/mock-data';

const querySchema = z.object({
  role: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

function fromMocks(params: z.infer<typeof querySchema>) {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 200;

  const filtered = mockStaffNumbers.filter((row) => {
    const roleMatch = params.role ? row.role === params.role : true;
    const activeMatch = params.active ? String(row.active) === params.active : true;
    const searchMatch = params.search
      ? `${row.barName} ${row.number}`.toLowerCase().includes(params.search.toLowerCase())
      : true;
    return roleMatch && activeMatch && searchMatch;
  });

  const slice = filtered.slice(offset, offset + limit);
  const hasMore = offset + slice.length < filtered.length;

  return NextResponse.json(
    {
      data: slice,
      total: filtered.length,
      hasMore,
      integration: {
        status: 'degraded' as const,
        target: 'staff_numbers',
        message: 'Supabase credentials missing. Showing mock staff numbers.'
      }
    },
    { status: 200 }
  );
}

export async function GET(request: Request) {
  let params: z.infer<typeof querySchema>;
  try {
    params = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return NextResponse.json(
      { error: 'invalid_query', message: error instanceof z.ZodError ? error.flatten() : 'Invalid query parameters.' },
      { status: 400 }
    );
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return fromMocks(params);
  }

  const offset = params.offset ?? 0;
  const limit = params.limit ?? 200;

  const supabaseQuery = adminClient
    .from('bar_numbers')
    .select('id, number_e164, role, is_active, verified_at, created_by, last_seen_at, bar:bar_id(name)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.role) {
    supabaseQuery.eq('role', params.role);
  }
  if (params.active) {
    supabaseQuery.eq('is_active', params.active === 'true');
  }
  if (params.search) {
    const pattern = `%${params.search}%`;
    supabaseQuery.or(
      `number_e164.ilike.${pattern},bar.name.ilike.${pattern}`
    );
  }

  const { data, error, count } = await supabaseQuery;
  if (error) {
    logStructured({
      event: 'staff_numbers_fetch_failed',
      target: 'staff_numbers',
      status: 'error',
      message: error.message
    });
    return fromMocks(params);
  }

  const rows = data ?? [];
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return NextResponse.json(
    {
      data: rows.map((row) => ({
        id: row.id,
        barName: row.bar?.name ?? 'Unknown bar',
        number: row.number_e164 ?? 'Unknown',
        role: row.role ?? 'staff',
        active: row.is_active ?? false,
        verified: Boolean(row.verified_at),
        addedBy: row.created_by ?? null,
        lastSeenAt: row.last_seen_at ?? null
      })),
      total,
      hasMore
    },
    { status: 200 }
  );
}
