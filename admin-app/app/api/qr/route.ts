export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { logStructured } from '@/lib/server/logger';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const querySchema = z.object({
  stationId: z.string().uuid().optional(),
  printed: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export const GET = createHandler('admin_api.qr_tokens.list', async (request, _context, { recordMetric }) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    recordMetric('qr_tokens.supabase_unavailable', 1);
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to fetch QR tokens.' }, 503);
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    recordMetric('qr_tokens.invalid_query', 1);
    return zodValidationError(error);
  }

  const rangeStart = query.offset ?? 0;
  const rangeEnd = rangeStart + (query.limit ?? 100) - 1;

  const supabaseQuery = adminClient
    .from('qr_tokens')
    .select('id, station_id, table_label, token, printed, created_at, last_scan_at, station:station_id(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(rangeStart, rangeEnd);

  if (query.stationId) {
    supabaseQuery.eq('station_id', query.stationId);
  }
  if (query.printed) {
    supabaseQuery.eq('printed', query.printed === 'true');
  }

  const { data, error, count } = await supabaseQuery;
  if (error) {
    logStructured({
      event: 'qr_tokens_fetch_failed',
      target: 'qr_tokens',
      status: 'error',
      message: error.message
    });
    recordMetric('qr_tokens.supabase_error', 1, { message: error.message });
    return jsonError({ error: 'qr_tokens_fetch_failed', message: 'Unable to load QR tokens.' }, 500);
  }

  const entries = (data ?? []).map((row: any) => ({
    id: row.id,
    stationId: row.station_id,
    barName: (row.station as any)?.name ?? 'Unknown station',
    tableLabel: row.table_label,
    token: row.token,
    printed: row.printed ?? false,
    createdAt: row.created_at,
    lastScanAt: row.last_scan_at
  }));

  const total = count ?? entries.length;
  const hasMore = rangeStart + entries.length < total;
  recordMetric('qr_tokens.success', 1, { total });

  return jsonOk({ data: entries, total, hasMore });
});
import { jsonError, jsonOk, zodValidationError } from '@/lib/api/http';

export const runtime = "nodejs";
