export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { createHandler } from '@/app/api/withObservability';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';

const querySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export const GET = createHandler('admin_api.notifications.list', async (request, _context, { recordMetric }) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    recordMetric('notifications.supabase_unavailable', 1);
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase credentials missing. Unable to fetch notifications.'
    }, 503);
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    recordMetric('notifications.invalid_query', 1);
    return zodValidationError(error);
  }

  const rangeStart = query.offset ?? 0;
  const rangeEnd = rangeStart + (query.limit ?? 100) - 1;

  const supabaseQuery = adminClient
    .from('notifications')
    .select('id, to_role, type, status, created_at, sent_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(rangeStart, rangeEnd);

  if (query.status) {
    supabaseQuery.eq('status', query.status);
  }

  const { data, error, count } = await supabaseQuery;
  if (error) {
    logStructured({
      event: 'notifications_fetch_failed',
      target: 'notifications',
      status: 'error',
      message: error.message
    });
    recordMetric('notifications.supabase_error', 1, { message: error.message });
    return jsonError({ error: 'notifications_fetch_failed', message: 'Unable to load notifications.' }, 500);
  }

  const rows = data ?? [];
  const total = count ?? rows.length;
  const hasMore = rangeStart + rows.length < total;
  recordMetric('notifications.success', 1, { total });

  return jsonOk({
    data: rows.map((row) => ({
      id: row.id,
      toRole: row.to_role,
      type: row.type,
      status: row.status,
      createdAt: row.created_at,
      sentAt: row.sent_at
    })),
    total,
    hasMore
  });
});

export const runtime = "edge";
