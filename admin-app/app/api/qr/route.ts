import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';

const querySchema = z.object({
  stationId: z.string().uuid().optional(),
  printed: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export async function GET(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: 'supabase_unavailable', message: 'Supabase credentials missing.' },
      { status: 503 }
    );
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return NextResponse.json(
      { error: 'invalid_query', message: error instanceof z.ZodError ? error.flatten() : 'Invalid query parameters.' },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: 'qr_tokens_fetch_failed', message: 'Unable to load QR tokens.' },
      { status: 500 }
    );
  }

  const entries = (data ?? []).map((row) => ({
    id: row.id,
    stationId: row.station_id,
    barName: row.station?.name ?? 'Unknown station',
    tableLabel: row.table_label,
    token: row.token,
    printed: row.printed ?? false,
    createdAt: row.created_at,
    lastScanAt: row.last_scan_at
  }));

  const total = count ?? entries.length;
  const hasMore = rangeStart + entries.length < total;

  return NextResponse.json(
    {
      data: entries,
      total,
      hasMore
    },
    { status: 200 }
  );
}
