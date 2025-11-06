export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { createHandler } from '@/app/api/withObservability';

const querySchema = z.object({
  status: z.string().optional(),
  barId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export const GET = createHandler('admin_api.orders.list', async (request, _context, { recordMetric }) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    recordMetric('orders.supabase_unavailable', 1);
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to fetch orders.' }, 503);
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    recordMetric('orders.invalid_query', 1);
    return zodValidationError(error);
  }

  const rangeStart = query.offset ?? 0;
  const rangeEnd = rangeStart + (query.limit ?? 100) - 1;

  const supabaseQuery = adminClient
    .from('orders')
    .select('id, bar_id, bar_name, table_label, status, total, created_at, updated_at, staff_number', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(rangeStart, rangeEnd);

  if (query.status) {
    supabaseQuery.eq('status', query.status);
  }
  if (query.barId) {
    supabaseQuery.eq('bar_id', query.barId);
  }

  const { data, error, count } = await supabaseQuery;
  if (error) {
    logStructured({
      event: 'orders_fetch_failed',
      target: 'orders',
      status: 'error',
      message: error.message
    });
    recordMetric('orders.supabase_error', 1, { message: error.message });
    return jsonError({ error: 'orders_fetch_failed', message: 'Unable to load orders.' }, 500);
  }

  const orders = (data ?? []).map((row) => ({
    id: row.id,
    barId: row.bar_id ?? '',
    barName: row.bar_name ?? 'Unknown',
    table: row.table_label,
    status: row.status,
    total: Number(row.total ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    staffNumber: row.staff_number ?? null
  }));

  const total = count ?? orders.length;
  const hasMore = rangeStart + orders.length < total;

  recordMetric('orders.success', 1, { total });

  return jsonOk({ data: orders, total, hasMore });
});
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';

export const runtime = "edge";
