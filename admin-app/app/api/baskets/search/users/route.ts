import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const querySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export async function GET(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to search users.',
      },
      { status: 503 },
    );
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_query',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid query parameters.',
      },
      { status: 400 },
    );
  }

  const term = `%${query.q}%`;
  const limit = query.limit ?? 10;

  const { data, error } = await adminClient
    .from('profiles')
    .select('user_id, display_name, msisdn', { count: 'exact' })
    .or(`display_name.ilike.${term},msisdn.ilike.${term}`)
    .limit(limit);

  if (error) {
    return NextResponse.json(
      {
        error: 'user_search_failed',
        message: 'Unable to search profiles.',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: (data ?? []).map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      msisdn: row.msisdn,
    })),
  });
}

