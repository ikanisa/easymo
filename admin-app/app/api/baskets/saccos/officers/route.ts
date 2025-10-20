export const dynamic = 'force-dynamic';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';

const listQuerySchema = z.object({
  saccoId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const createSchema = z.object({
  saccoId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['manager', 'officer', 'teller', 'compliance']).default('officer'),
});

export async function GET(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase credentials missing. Unable to fetch officers.',
    }, 503);
  }

  let query: z.infer<typeof listQuerySchema>;
  try {
    query = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return zodValidationError(error);
  }

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 100;
  const rangeEnd = offset + limit - 1;

  const supabaseQuery = adminClient
    .from('sacco_officers')
    .select(
      `id, sacco_id, user_id, role, created_at,
       saccos:sacco_id (id, name, branch_code),
       profiles:user_id (user_id, display_name, msisdn)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, rangeEnd);

  if (query.saccoId) {
    supabaseQuery.eq('sacco_id', query.saccoId);
  }

  const { data, error, count } = await supabaseQuery;

  if (error) {
    logStructured({
      event: 'sacco_officers_fetch_failed',
      target: 'sacco_officers',
      status: 'error',
      message: error.message,
    });
    return jsonError({ error: 'sacco_officers_fetch_failed', message: 'Unable to load SACCO officers.' }, 500);
  }

  const rows = data ?? [];
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return jsonOk({
    data: rows.map((row) => ({
      id: row.id,
      saccoId: row.sacco_id,
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
      sacco: row.saccos ? {
        id: row.saccos.id,
        name: row.saccos.name,
        branchCode: row.saccos.branch_code,
      } : null,
      profile: row.profiles ? {
        userId: row.profiles.user_id,
        displayName: row.profiles.display_name ?? null,
        msisdn: row.profiles.msisdn ?? null,
      } : null,
    })),
    total,
    hasMore,
  });
}

export async function POST(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase credentials missing. Unable to create officer.',
    }, 503);
  }

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch (error) {
    return zodValidationError(error);
  }

  let actorId: string;
  try {
    actorId = requireActorId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonError({ error: 'unauthorized', message: err.message }, 401);
    }
    throw err;
  }

  const { data, error } = await adminClient
    .from('sacco_officers')
    .insert({
      sacco_id: payload.saccoId,
      user_id: payload.userId,
      role: payload.role,
    })
    .select(
      `id, sacco_id, user_id, role, created_at,
       saccos:sacco_id (id, name, branch_code),
       profiles:user_id (user_id, display_name, msisdn)`
    )
    .single();

  if (error || !data) {
    logStructured({
      event: 'sacco_officers_create_failed',
      target: 'sacco_officers',
      status: 'error',
      message: error?.message ?? 'Unknown error',
    });
    return jsonError({ error: 'sacco_officers_create_failed', message: 'Unable to create SACCO officer.' }, 500);
  }

  await recordAudit({
    actorId,
    action: 'sacco_officer_create',
    targetTable: 'sacco_officers',
    targetId: data.id,
    diff: {
      sacco_id: payload.saccoId,
      user_id: payload.userId,
      role: payload.role,
    },
  });

  return jsonOk({
    id: data.id,
    saccoId: data.sacco_id,
    userId: data.user_id,
    role: data.role,
    createdAt: data.created_at,
    sacco: data.saccos ? {
      id: data.saccos.id,
      name: data.saccos.name,
      branchCode: data.saccos.branch_code,
    } : null,
    profile: data.profiles ? {
      userId: data.profiles.user_id,
      displayName: data.profiles.display_name ?? null,
      msisdn: data.profiles.msisdn ?? null,
    } : null,
  }, 201);
}
