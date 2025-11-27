export const dynamic = 'force-dynamic';

import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { jsonOk, zodValidationError } from '@/lib/api/http';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const GET = createHandler('admin_api.audit.list', async (request) => {
  const admin = getSupabaseAdminClient();
  let params: z.infer<typeof querySchema>;
  try {
    params = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return zodValidationError(error);
  }

  if (!admin) {
    return jsonOk({ data: [], total: 0, hasMore: false });
  }

  const { limit = 50, offset = 0 } = params;
  const { data, error, count } = await admin
    .from('audit_log')
    .select('id, actor_id, action, target_table, target_id, created_at, summary')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return jsonOk({ data: [], total: 0, hasMore: false });

  const rows = (data ?? []).map((row: any) => ({
    id: String(row.id),
    actor: row.actor_id ?? 'system',
    action: row.action ?? '',
    targetTable: row.target_table ?? '',
    targetId: String(row.target_id ?? ''),
    createdAt: row.created_at ?? new Date().toISOString(),
    summary: row.summary ?? null,
  }));
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;
  return jsonOk({ data: rows, total, hasMore });
});

export const runtime = 'nodejs';

