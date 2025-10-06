import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';

const querySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export async function GET(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to fetch notifications.'
      },
      { status: 503 }
    );
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_query',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid query parameters.'
      },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: 'notifications_fetch_failed', message: 'Unable to load notifications.' },
      { status: 500 }
    );
  }

  const rows = data ?? [];
  const total = count ?? rows.length;
  const hasMore = rangeStart + rows.length < total;

  return NextResponse.json(
    {
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
    },
    { status: 200 }
  );
}
