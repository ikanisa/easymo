export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { createHandler } from '@/app/api/withObservability';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  whatsappE164: z.string().regex(/^\+[1-9]\d{6,14}$/).optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = createHandler('admin_api.wallet.partners.update', async (_req, ctx) => {
  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError({ error: 'supabase_unavailable' }, 503);
  const id = ctx.params?.id as string;
  let body: z.infer<typeof patchSchema>;
  try { body = patchSchema.parse(await _req.json()); } catch (e) { return zodValidationError(e); }
  const update: Record<string, unknown> = {};
  if (body.name) update.name = body.name;
  if (body.whatsappE164) update.whatsapp_e164 = body.whatsappE164;
  if (body.category !== undefined) update.category = body.category;
  if (body.isActive !== undefined) update.is_active = body.isActive;
  const { data, error } = await admin.from('token_partners').update(update).eq('id', id).select().single();
  if (error) return jsonError({ error: 'update_failed', message: error.message }, 500);
  return jsonOk({ data });
});

export const DELETE = createHandler('admin_api.wallet.partners.delete', async (_req, ctx) => {
  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError({ error: 'supabase_unavailable' }, 503);
  const id = ctx.params?.id as string;
  const { error } = await admin.from('token_partners').update({ is_active: false }).eq('id', id);
  if (error) return jsonError({ error: 'delete_failed', message: error.message }, 500);
  return jsonOk({ ok: true });
});

export const runtime = 'nodejs';

