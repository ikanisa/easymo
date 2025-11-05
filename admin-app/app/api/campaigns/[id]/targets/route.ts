export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { createHandler } from '@/app/api/withObservability';

const querySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  search: z.string().optional()
});

export const GET = createHandler('admin_api.campaigns.id.targets', async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase credentials missing. Unable to fetch campaign targets.',
    }, 503);
  }

  const campaignId = params.id;
  if (!z.string().uuid().safeParse(campaignId).success) {
    return jsonError({ error: 'invalid_campaign_id', message: 'Invalid campaign ID.' }, 400);
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return zodValidationError(error);
  }

  const rangeStart = query.offset ?? 0;
  const rangeEnd = rangeStart + (query.limit ?? 50) - 1;

  const supabaseQuery = adminClient
    .from('campaign_targets')
    .select('id, msisdn, user_id, personalized_vars, status, error_code, message_id, last_update_at', { count: 'exact' })
    .eq('campaign_id', campaignId)
    .order('last_update_at', { ascending: false })
    .range(rangeStart, rangeEnd);

  if (query.status) {
    supabaseQuery.eq('status', query.status);
  }
  if (query.search) {
    supabaseQuery.ilike('msisdn', `%${query.search}%`);
  }

  const { data, error, count } = await supabaseQuery;
  if (error) {
    logStructured({
      event: 'campaign_targets_fetch_failed',
      target: 'campaign_targets',
      status: 'error',
      message: error.message,
      details: { campaignId }
    });
    return jsonError({ error: 'campaign_targets_fetch_failed', message: 'Unable to load campaign targets.' }, 500);
  }

  return jsonOk({
    data: data?.map((row) => ({
      id: row.id,
      msisdn: row.msisdn,
      userId: row.user_id,
      personalizedVars: row.personalized_vars,
      status: row.status,
      errorCode: row.error_code,
      messageId: row.message_id,
      lastUpdateAt: row.last_update_at,
    })) ?? [],
    total: count ?? 0,
  });
});
