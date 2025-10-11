import { headers } from 'next/headers';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';

const updateSchema = z.object({
  quietHours: z.object({ start: z.string(), end: z.string() }).optional(),
  templates: z.record(z.string()).optional(),
  featureFlags: z.object({
    module_enabled: z.boolean().optional(),
    allocator_enabled: z.boolean().optional(),
    loans_enabled: z.boolean().optional(),
  }).optional(),
  reminderThrottle: z.number().int().min(0).max(500).optional(),
});

export async function GET() {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase credentials missing. Unable to fetch settings.',
    }, 503);
  }

  const { data, error } = await adminClient
    .from('settings')
    .select('key, value')
    .in('key', ['baskets.quiet_hours', 'baskets.templates', 'baskets.feature_flags', 'baskets.reminder_throttle']);

  if (error) {
    logStructured({
      event: 'baskets_settings_fetch_failed',
      target: 'settings',
      status: 'error',
      message: error.message,
    });
    return jsonError({ error: 'settings_fetch_failed', message: 'Unable to load Baskets settings.' }, 500);
  }

  const map = new Map((data ?? []).map((row) => [row.key, row.value]));

  const throttleSetting = map.get('baskets.reminder_throttle');
  let reminderThrottle: number | null = null;
  if (typeof throttleSetting === 'number') {
    reminderThrottle = throttleSetting;
  } else if (typeof throttleSetting === 'object' && throttleSetting !== null) {
    const perHour = (throttleSetting as { per_hour?: number }).per_hour;
    reminderThrottle = perHour != null ? Number(perHour) : null;
  }

  return jsonOk({
    quietHours: map.get('baskets.quiet_hours') ?? null,
    templates: map.get('baskets.templates') ?? null,
    featureFlags: map.get('baskets.feature_flags') ?? null,
    reminderThrottle,
  });
}

export async function PATCH(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase credentials missing. Unable to update settings.',
    }, 503);
  }

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    return zodValidationError(error);
  }

  if (!payload.quietHours && !payload.templates && !payload.featureFlags && payload.reminderThrottle === undefined) {
    return jsonError({ error: 'empty_update', message: 'Provide at least one settings group to update.' }, 400);
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

  const updates: Array<{ key: string; value: unknown }> = [];
  if (payload.quietHours) updates.push({ key: 'baskets.quiet_hours', value: payload.quietHours });
  if (payload.templates) updates.push({ key: 'baskets.templates', value: payload.templates });
  if (payload.featureFlags) updates.push({ key: 'baskets.feature_flags', value: payload.featureFlags });
  if (payload.reminderThrottle !== undefined) updates.push({ key: 'baskets.reminder_throttle', value: { per_hour: payload.reminderThrottle } });

  for (const entry of updates) {
    const { error } = await adminClient
      .from('settings')
      .upsert({ key: entry.key, value: entry.value, updated_at: new Date().toISOString() });
    if (error) {
      logStructured({
        event: 'baskets_settings_update_failed',
        target: 'settings',
        status: 'error',
        message: error.message,
        details: { key: entry.key },
      });
      return jsonError({ error: 'settings_update_failed', message: `Unable to update ${entry.key}.` }, 500);
    }
  }

  await recordAudit({
    actorId,
    action: 'baskets_settings_update',
    targetTable: 'settings',
    targetId: 'baskets',
    diff: payload,
  });

  return jsonOk({ success: true });
}
