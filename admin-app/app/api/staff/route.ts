export const dynamic = 'force-dynamic';
import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { jsonError, jsonOk, zodValidationError } from '@/lib/api/http';
import { logStructured } from '@/lib/server/logger';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const querySchema = z.object({
  role: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

function unavailable(message: string, code = 503) {
  return jsonError({ error: 'unavailable', message }, code);
}

export const GET = createHandler('admin_api.staff.list', async (request: Request) => {
  let params: z.infer<typeof querySchema>;
  try {
    params = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return zodValidationError(error);
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return unavailable('Supabase credentials missing.');
  }

  const { offset = 0, limit = 200, role, active, search } = params;

  const supabaseQuery = adminClient
    .from('bar_numbers')
    .select('id, number_e164, role, is_active, verified_at, created_by, last_seen_at, bar:bar_id(name)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (role) {
    supabaseQuery.eq('role', role);
  }
  if (active) {
    supabaseQuery.eq('is_active', active === 'true');
  }
  if (search) {
    const pattern = `%${search}%`;
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
    return unavailable('Unable to load staff numbers.', 500);
  }

  const rows = data ?? [];
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return jsonOk({
    data: rows.map((row: any) => {
      const bar = row.bar as any;
      const barName = Array.isArray(bar) 
        ? (bar[0]?.name ?? 'Unknown bar') 
        : (bar?.name ?? 'Unknown bar');
      
      return {
        id: row.id,
        barName,
        number: row.number_e164 ?? 'Unknown',
        role: row.role ?? 'staff',
        active: row.is_active ?? false,
        verified: Boolean(row.verified_at),
        addedBy: row.created_by ?? null,
        lastSeenAt: row.last_seen_at ?? null,
      };
    }),
    total,
    hasMore,
  });
});

export const runtime = "nodejs";
