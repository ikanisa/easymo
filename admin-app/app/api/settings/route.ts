export const dynamic = 'force-dynamic';
import { headers } from 'next/headers';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { createHandler } from '@/app/api/withObservability';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { mockSettingsEntries } from '@/lib/mock-data';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';

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

function buildDegradedResponse(message: string, status = 503) {
  return jsonOk(
    {
      integration: {
        status: 'degraded' as const,
        message,
        target: 'settings_store'
      }
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
      status: 'degraded',
      message: 'Failed to load settings from Supabase. Falling back to mocks.',
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

function fallbackSettings() {
  const quiet = mockSettingsEntries.find((entry) => entry.key === 'quiet_hours.rw');
  const throttle = mockSettingsEntries.find((entry) => entry.key === 'send_throttle.whatsapp.per_minute');
  const optOut = mockSettingsEntries.find((entry) => entry.key === 'opt_out.list');
  return {
    quietHours: () => ({
      start: quiet ? quiet.valuePreview.split('–')[0].trim() : '22:00',
      end: quiet ? quiet.valuePreview.split('–')[1].trim() : '06:00'
    }),
    throttlePerMinute: throttle ? Number(throttle.valuePreview) : 60,
    optOutList: optOut ? (JSON.parse(optOut.valuePreview) as string[]) : []
  };
}

export const GET = createHandler('admin_api.settings.get', async () => {
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

  const fallback = fallbackSettings();
  return jsonOk({
    quietHours: fallback.quietHours(),
    throttlePerMinute: fallback.throttlePerMinute,
    optOutList: fallback.optOutList,
    integration: {
      status: 'degraded' as const,
      message: 'Using mock settings because Supabase credentials are not configured.',
      target: 'settings_store'
    }
  });
});

export const POST = createHandler('admin_api.settings.post', async (request: Request) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return buildDegradedResponse('Supabase service role not available. Configure environment variables to persist settings.');
  }

  let parsed: z.infer<typeof settingsMutationSchema>;
  try {
    const json = await request.json();
    parsed = settingsMutationSchema.parse(json);
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

  try {
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
    logStructured({
      event: 'settings_update_failed',
      target: 'settings_store',
      status: 'degraded',
      message: 'Failed to upsert settings in Supabase.',
      details: { error: error instanceof Error ? error.message : 'unknown' }
    });
    return jsonError({ error: 'settings_update_failed', message: 'Unable to persist settings. Try again later.' }, 500);
  }
});
 

export const runtime = "edge";
