export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';
import { createHandler } from '@/app/api/withObservability';

const getSchema = z.object({
  status: z.string().optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.enum(['promo', 'voucher']),
  templateId: z.string().min(1),
  status: z.enum(['draft', 'running', 'paused', 'done']).optional(),
  metadata: z.record(z.any()).optional()
});

export const GET = createHandler('admin_api.campaigns.list', async (request: Request) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to fetch campaigns.' }, 503);
  }

  let query: z.infer<typeof getSchema>;
  try {
    query = getSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return zodValidationError(error);
  }

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;

  const supabaseQuery = adminClient
    .from('campaigns')
    .select('id, name, type, status, template_id, created_at, started_at, finished_at, metadata', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (query.status) {
    supabaseQuery.eq('status', query.status);
  }

  if (query.search) {
    const likeTerm = `%${query.search}%`;
    supabaseQuery.or(`name.ilike.${likeTerm},id.eq.${query.search}`);
  }

  const { data, error, count } = await supabaseQuery;
  if (error) {
    logStructured({
      event: 'campaign_fetch_failed',
      target: 'campaigns',
      status: 'error',
      message: error.message
    });
    return jsonError({ error: 'campaign_fetch_failed', message: 'Unable to load campaigns.' }, 500);
  }

  const rows = data ?? [];
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return jsonOk({
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      templateId: row.template_id,
      createdAt: row.created_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      metadata: row.metadata ?? {}
    })),
    total,
    hasMore
  });
});

export const POST = createHandler('admin_api.campaigns.upsert', async (request: Request) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to persist campaigns.' }, 503);
  }

  let payload: z.infer<typeof upsertSchema>;
  try {
    payload = upsertSchema.parse(await request.json());
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
  const record = {
    id: payload.id,
    name: payload.name,
    type: payload.type,
    template_id: payload.templateId,
    status: payload.status ?? 'draft',
    metadata: payload.metadata ?? {}
  };

  const { data, error } = await adminClient
    .from('campaigns')
    .upsert(record)
    .select('id, name, type, status, template_id, created_at, started_at, finished_at, metadata')
    .single();

  if (error || !data) {
    logStructured({
      event: 'campaign_upsert_failed',
      target: 'campaigns',
      status: 'error',
      message: error?.message ?? 'Unknown error'
    });
    return jsonError({ error: 'campaign_upsert_failed', message: 'Unable to save campaign.' }, 500);
  }

  await recordAudit({
    actorId,
    action: payload.id ? 'campaign_update' : 'campaign_create',
    targetTable: 'campaigns',
    targetId: data.id,
    diff: record
  });

  logStructured({
    event: 'campaign_upsert',
    target: 'campaigns',
    status: 'ok',
    details: { campaignId: data.id, status: data.status }
  });

  return jsonOk({
    data: {
      id: data.id,
      name: data.name,
      type: data.type,
      status: data.status,
      templateId: data.template_id,
      createdAt: data.created_at,
      startedAt: data.started_at,
      finishedAt: data.finished_at,
      metadata: data.metadata ?? {}
    }
  });
});
