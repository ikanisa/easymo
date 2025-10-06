import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';

const listQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

const createSchema = z.object({
  name: z.string().min(1),
  engencode: z.string().min(1),
  ownerContact: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active')
});

export async function GET(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to fetch stations.'
      },
      { status: 503 }
    );
  }

  let query: z.infer<typeof listQuerySchema>;
  try {
    query = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
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

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 100;

  const supabaseQuery = adminClient
    .from('stations')
    .select('id, name, engencode, owner_contact, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (query.status) {
    supabaseQuery.eq('status', query.status);
  }
  if (query.search) {
    supabaseQuery.ilike('name', `%${query.search}%`);
  }

  const { data, error, count } = await supabaseQuery;
  if (error) {
    logStructured({
      event: 'stations_fetch_failed',
      target: 'stations',
      status: 'error',
      message: error.message
    });
    return NextResponse.json(
      {
        error: 'stations_fetch_failed',
        message: 'Unable to load stations.'
      },
      { status: 500 }
    );
  }

  const rows = data ?? [];
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return NextResponse.json(
    {
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        engencode: row.engencode,
        ownerContact: row.owner_contact,
        status: row.status,
        createdAt: row.created_at
      })),
      total,
      hasMore
    },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to create station.'
      },
      { status: 503 }
    );
  }

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.'
      },
      { status: 400 }
    );
  }

  const actorId = headers().get('x-actor-id');

  const { data, error } = await adminClient
    .from('stations')
    .insert({
      name: payload.name,
      engencode: payload.engencode,
      owner_contact: payload.ownerContact ?? null,
      status: payload.status
    })
    .select('id, name, engencode, owner_contact, status, created_at')
    .single();

  if (error || !data) {
    logStructured({
      event: 'station_create_failed',
      target: 'stations',
      status: 'error',
      message: error?.message ?? 'Unknown error'
    });
    return NextResponse.json(
      {
        error: 'station_create_failed',
        message: 'Unable to create station.'
      },
      { status: 500 }
    );
  }

  await recordAudit({
    actorId,
    action: 'station_create',
    targetTable: 'stations',
    targetId: data.id,
    diff: payload
  });

  logStructured({
    event: 'station_created',
    target: 'stations',
    status: 'ok',
    details: { stationId: data.id }
  });

  return NextResponse.json(
    {
      data: {
        id: data.id,
        name: data.name,
        engencode: data.engencode,
        ownerContact: data.owner_contact,
        status: data.status,
        createdAt: data.created_at
      }
    },
    { status: 201 }
  );
}
