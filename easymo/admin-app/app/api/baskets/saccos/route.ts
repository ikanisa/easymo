import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { requireActorId } from '@/lib/server/auth';

const listQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  branchCode: z.string().min(1),
  umurengeName: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  status: z.enum(['pending', 'active', 'suspended']).optional(),
  ltvMinRatio: z.coerce.number().min(0.1).max(10).optional(),
});

export async function GET(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to fetch SACCO branches.',
      },
      { status: 503 },
    );
  }

  let query: z.infer<typeof listQuerySchema>;
  try {
    query = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_query',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid query parameters.',
      },
      { status: 400 },
    );
  }

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  const rangeEnd = offset + limit - 1;

  const supabaseQuery = adminClient
    .from('saccos')
    .select('id, name, branch_code, umurenge_name, district, contact_phone, status, created_at, ltv_min_ratio', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, rangeEnd);

  if (query.status) {
    supabaseQuery.eq('status', query.status);
  }

  if (query.search) {
    const term = query.search;
    supabaseQuery.or(`name.ilike.%${term}%,branch_code.ilike.%${term}%`);
  }

  const { data, error, count } = await supabaseQuery;

  if (error) {
    logStructured({
      event: 'saccos_fetch_failed',
      target: 'saccos',
      status: 'error',
      message: error.message,
    });
    return NextResponse.json(
      {
        error: 'saccos_fetch_failed',
        message: 'Unable to load SACCO branches.',
      },
      { status: 500 },
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
        branchCode: row.branch_code,
        umurengeName: row.umurenge_name,
        district: row.district,
        contactPhone: row.contact_phone,
        status: row.status,
        createdAt: row.created_at,
        ltvMinRatio: Number(row.ltv_min_ratio ?? 1),
      })),
      total,
      hasMore,
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to create SACCO.',
      },
      { status: 503 },
    );
  }

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  let actorId: string;
  try {
    actorId = requireActorId();
  } catch (error) {
    return NextResponse.json(
      {
        error: 'unauthorized',
        message: error instanceof Error ? error.message : 'Unauthorized',
      },
      { status: 401 },
    );
  }

  const { data, error } = await adminClient
    .from('saccos')
    .insert({
      name: payload.name,
      branch_code: payload.branchCode,
      umurenge_name: payload.umurengeName ?? null,
      district: payload.district ?? null,
      contact_phone: payload.contactPhone ?? null,
      status: payload.status ?? 'pending',
      ltv_min_ratio: payload.ltvMinRatio ?? 1,
    })
    .select('id, name, branch_code, umurenge_name, district, contact_phone, status, created_at, ltv_min_ratio')
    .single();

  if (error || !data) {
    logStructured({
      event: 'saccos_create_failed',
      target: 'saccos',
      status: 'error',
      message: error?.message ?? 'Unknown error',
    });
    return NextResponse.json(
      {
        error: 'saccos_create_failed',
        message: 'Unable to create SACCO.',
      },
      { status: 500 },
    );
  }

  await recordAudit({
    actorId,
    action: 'saccos_create',
    targetTable: 'saccos',
    targetId: data.id,
    diff: data,
  });

  return NextResponse.json({
    id: data.id,
    name: data.name,
    branchCode: data.branch_code,
    umurengeName: data.umurenge_name,
    district: data.district,
    contactPhone: data.contact_phone,
    status: data.status,
    createdAt: data.created_at,
    ltvMinRatio: Number(data.ltv_min_ratio ?? 1),
  }, { status: 201 });
}
