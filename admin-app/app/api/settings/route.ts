export const dynamic = 'force-dynamic';
import { headers } from 'next/headers';
import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { handleAPIError, jsonError, jsonOk } from '@/lib/api/http';
import { rateLimit } from "@/lib/api/rate-limit";
import { recordAudit } from '@/lib/server/audit';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';
import { logStructured } from '@/lib/server/logger';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const settingsResponseSchema = z.object({
  quietHours: z.object({ start: z.string(), end: z.string() }),
  throttlePerMinute: z.number(),
  optOutList: z.array(z.string())
});

const settingsMutationSchema = z.object({
  quietHours: z.object({ start: z.string(), end: z.string() }),
  throttlePerMinute: z.number().min(0),
  optOutList: z.array(z.string())
});

function buildDegradedError(message: string, status = 503) {
  return jsonError(
    {
      error: 'settings_unavailable',
      message,
    },
    status,
  );
}

async function fetchSettingsFromSupabase() {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return null;
  const { data, error } = await adminClient.from('settings').select('key, value');
  if (error || !data) {
    logStructured({
      event: 'settings_fetch_failed',
      target: 'supabase',
      status: 'error',
      message: 'Failed to load settings from Supabase.',
      details: { error: error?.message }
    });
    return null;
  }
  const entries = new Map<string, unknown>();
  for (const row of data) {
    entries.set(row.key, row.value);
  }
  return entries;
}

export const GET = createHandler('admin_api.settings.get', async (request: Request) => {
  try {
    const limiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 500 });
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    await limiter.check(30, ip); // 30 requests per minute

    const supabaseSettings = await fetchSettingsFromSupabase();
    if (supabaseSettings) {
      const quiet = supabaseSettings.get('quiet_hours.rw') as { start: string; end: string } | null;
      const throttleValue = supabaseSettings.get('send_throttle.whatsapp.per_minute') as { value?: number } | number | null;
      const optOut = supabaseSettings.get('opt_out.list') as string[] | null;
      const payload = {
        quietHours: {
          start: quiet?.start ?? '22:00',
          end: quiet?.end ?? '06:00'
        },
        throttlePerMinute:
          typeof throttleValue === 'number' ? throttleValue : throttleValue?.value ?? 60,
        optOutList: Array.isArray(optOut) ? optOut : []
      } satisfies z.infer<typeof settingsResponseSchema>;
      return jsonOk(payload);
    }

    return buildDegradedError('Supabase credentials are not configured.');
  } catch (error) {
    return handleAPIError(error);
  }
});

export const POST = createHandler('admin_api.settings.post', async (request: Request) => {
  try {
    const limiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 500 });
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    await limiter.check(10, ip); // 10 requests per minute for updates

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) {
      return buildDegradedError('Supabase service role not available. Configure environment variables to persist settings.');
    }

    const json = await request.json();
    const parsed = settingsMutationSchema.parse(json);

    let actorId: string;
    try {
      actorId = requireActorId();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return jsonError({ error: 'unauthorized', message: err.message }, 401);
      }
      throw err;
    }

    const timestamp = new Date().toISOString();
    await adminClient.from('settings').upsert([
      { key: 'quiet_hours.rw', value: parsed.quietHours, updated_at: timestamp },
      { key: 'send_throttle.whatsapp.per_minute', value: { value: parsed.throttlePerMinute }, updated_at: timestamp },
      { key: 'opt_out.list', value: parsed.optOutList, updated_at: timestamp }
    ]);

    await recordAudit({
      actorId,
      action: 'settings_update',
      targetTable: 'settings',
      targetId: 'quiet_hours.rw',
      diff: {
        quietHours: parsed.quietHours,
        throttlePerMinute: parsed.throttlePerMinute,
        optOutListCount: parsed.optOutList.length
      }
    });

    logStructured({
      event: 'settings_updated',
      target: 'settings_store',
      status: 'ok',
      details: {
        throttlePerMinute: parsed.throttlePerMinute,
        optOutCount: parsed.optOutList.length
      }
    });

    return jsonOk({
      message: 'Settings saved.',
      integration: { status: 'ok' as const, target: 'settings_store' }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError({ error: 'validation_error', details: error.flatten() }, 400);
    }
    return handleAPIError(error);
  }
});
 
export const runtime = "nodejs";
