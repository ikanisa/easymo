export const dynamic = 'force-dynamic';

import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { jsonOk, zodValidationError } from '@/lib/api/http';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

function previewOf(value: unknown): string {
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  } catch {
    return String(value);
  }
}

export const GET = createHandler('admin_api.settings.preview', async (request) => {
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

  const { limit = 100, offset = 0 } = params;
  const { data, error, count } = await admin
    .from('settings')
    .select('key, value, updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return jsonOk({ data: [], total: 0, hasMore: false });
  }

  const rows = (data ?? []).map((row: any) => ({
    key: row.key,
    description: '',
    updatedAt: row.updated_at ?? new Date().toISOString(),
    valuePreview: previewOf(row.value),
  }));
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;
  return jsonOk({ data: rows, total, hasMore });
});

export const runtime = 'nodejs';

