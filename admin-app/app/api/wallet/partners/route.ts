export const dynamic = 'force-dynamic';
import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { jsonError, jsonOk, zodValidationError } from '@/lib/api/http';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const querySchema = z.object({
  active: z.enum(['true','false']).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const bodySchema = z.object({
  name: z.string().min(2),
  whatsappE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const GET = createHandler('admin_api.wallet.partners.list', async (request) => {
  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError({ error: 'supabase_unavailable' }, 503);
  let query: z.infer<typeof querySchema>;
  try { query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams)); }
  catch (e) { return zodValidationError(e); }
  const { active, q, limit = 50, offset = 0 } = query;
  const supa = admin.from('token_partners')
    .select('id, name, whatsapp_e164, category, is_active, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (active) supa.eq('is_active', active === 'true');
  if (q) supa.or(`name.ilike.%${q}%,whatsapp_e164.ilike.%${q}%`);
  const { data, error, count } = await supa;
  if (error) return jsonError({ error: 'query_failed', message: error.message }, 500);
  return jsonOk({ data, total: count ?? data?.length ?? 0 });
});

export const POST = createHandler('admin_api.wallet.partners.create', async (request) => {
  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError({ error: 'supabase_unavailable' }, 503);
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await request.json()); } catch (e) { return zodValidationError(e); }
  const { data, error } = await admin.from('token_partners').insert({
    name: body.name, whatsapp_e164: body.whatsappE164, category: body.category ?? null, is_active: body.isActive ?? true,
  }).select().single();
  if (error) return jsonError({ error: 'insert_failed', message: error.message }, 500);
  return jsonOk({ data });
});

export const runtime = 'nodejs';

