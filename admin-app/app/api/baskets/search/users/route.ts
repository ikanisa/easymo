export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';

const querySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export async function GET(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to search users.' }, 503);
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return zodValidationError(error);
  }

  const term = `%${query.q}%`;
  const limit = query.limit ?? 10;

  const { data, error } = await adminClient
    .from('profiles')
    .select('user_id, display_name, msisdn', { count: 'exact' })
    .or(`display_name.ilike.${term},msisdn.ilike.${term}`)
    .limit(limit);

  if (error) {
    return jsonError({ error: 'user_search_failed', message: 'Unable to search profiles.' }, 500);
  }

  return jsonOk({
    data: (data ?? []).map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      msisdn: row.msisdn,
    })),
  });
}
