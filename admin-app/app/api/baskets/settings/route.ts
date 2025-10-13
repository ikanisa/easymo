import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';

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
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to fetch settings.',
      },
      { status: 503 },
    );
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
    return NextResponse.json(
      {
        error: 'settings_fetch_failed',
        message: 'Unable to load Baskets settings.',
      },
      { status: 500 },
    );
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

  return NextResponse.json({
    quietHours: map.get('baskets.quiet_hours') ?? null,
    templates: map.get('baskets.templates') ?? null,
    featureFlags: map.get('baskets.feature_flags') ?? null,
    reminderThrottle,
  });
}

export async function PATCH(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to update settings.',
      },
      { status: 503 },
    );
  }

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  if (!payload.quietHours && !payload.templates && !payload.featureFlags && payload.reminderThrottle === undefined) {
    return NextResponse.json(
      { error: 'empty_update', message: 'Provide at least one settings group to update.' },
      { status: 400 },
    );
  }

  const actorId = headers().get('x-actor-id');

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
      return NextResponse.json(
        {
          error: 'settings_update_failed',
          message: `Unable to update ${entry.key}.`,
        },
        { status: 500 },
      );
    }
  }

  await recordAudit({
    actorId,
    action: 'baskets_settings_update',
    targetTable: 'settings',
    targetId: 'baskets',
    diff: payload,
  });

  return NextResponse.json({ success: true });
}
