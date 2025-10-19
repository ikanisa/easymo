import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';

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
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to fetch memberships.' }, 503);
  }

  let query: z.infer<typeof listQuerySchema>;
  try {
    query = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return zodValidationError(error);
  }

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 100;
  const rangeEnd = offset + limit - 1;

  const supabaseQuery = adminClient
    .from('ibimina_members')
    .select(
      `id, ikimina_id, user_id, status, joined_at,
       ibimina:ikimina_id (id, name, status, sacco_id),
       profiles:user_id (user_id, display_name, msisdn)` ,
      { count: 'exact' },
    )
    .order('joined_at', { ascending: false })
    .range(offset, rangeEnd);

  if (query.status) {
    supabaseQuery.eq('status', query.status);
  }

  if (query.saccoId) {
    supabaseQuery.eq('ibimina.sacco_id', query.saccoId);
  }

  if (query.search) {
    const term = `%${query.search}%`;
    supabaseQuery.or(`profiles.display_name.ilike.${term},profiles.msisdn.ilike.${term}`);
  }

  const { data, error, count } = await supabaseQuery;

  if (error) {
    logStructured({
      event: 'ibimina_members_fetch_failed',
      target: 'ibimina_members',
      status: 'error',
      message: error.message,
    });
    return jsonError({ error: 'ibimina_members_fetch_failed', message: 'Unable to load memberships.' }, 500);
  }

  const rows = (data ?? []) as any[];
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return jsonOk({
    data: rows.map((row) => ({
      id: row.id,
        ikiminaId: row.ikimina_id,
        userId: row.user_id,
        status: row.status,
        joinedAt: row.joined_at,
        saccoId: row.ibimina?.sacco_id ?? null,
        ikimina: row.ibimina ? {
          id: row.ibimina.id,
          name: row.ibimina.name,
          status: row.ibimina.status,
          saccoId: row.ibimina.sacco_id ?? null,
        } : {
          id: row.ikimina_id,
          name: 'Unknown',
          status: 'pending',
          saccoId: null,
        },
        profile: row.profiles ? {
          userId: row.profiles.user_id,
          displayName: row.profiles.display_name ?? null,
          msisdn: row.profiles.msisdn ?? null,
        } : null,
    })),
    total,
    hasMore,
  });
}
