import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/lib/server/audit';
import { mockSettingsEntries } from '@/lib/mock-data';

const settingsSchema = z.object({
  quietHours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/)
  }),
  throttlePerMinute: z.number().int().min(0),
  optOutList: z.array(z.string())
});

export const dynamic = 'force-dynamic';

export async function GET() {
  const quiet = mockSettingsEntries.find((entry) => entry.key === 'quiet_hours.rw');
  const throttle = mockSettingsEntries.find((entry) => entry.key === 'send_throttle.whatsapp.per_minute');
  const optOut = mockSettingsEntries.find((entry) => entry.key === 'opt_out.list');

  return NextResponse.json({
    quietHours: quiet ? quiet.valuePreview : '22:00 – 06:00',
    throttlePerMinute: throttle ? Number(throttle.valuePreview) : 60,
    optOutList: optOut ? JSON.parse(optOut.valuePreview) : [],
    integration: {
      target: 'policySettings',
      status: 'degraded',
      reason: 'mock_preview',
      message: 'Showing mock settings preview. Configure Supabase keys to load persisted values.'
    }
  });
}

export async function POST(request: Request) {
  try {
    const payload = settingsSchema.parse(await request.json());
    const { getSupabaseAdminClient } = await import('@/lib/server/supabase-admin');
    const adminClient = getSupabaseAdminClient();
    let supabaseStatus: 'ok' | 'failed' = 'failed';

    if (adminClient) {
      const { error } = await adminClient
        .from('settings')
        .upsert([
          { key: 'quiet_hours.rw', value: payload.quietHours },
          { key: 'send_throttle.whatsapp.per_minute', value: { value: payload.throttlePerMinute } },
          { key: 'opt_out.list', value: payload.optOutList }
        ]);
      if (error) {
        console.error('Supabase settings upsert failed', error);
      } else {
        supabaseStatus = 'ok';
      }
    }

    mockSettingsEntries.splice(
      0,
      mockSettingsEntries.length,
      ...mockSettingsEntries.filter(
        (entry) =>
          entry.key !== 'quiet_hours.rw' &&
          entry.key !== 'send_throttle.whatsapp.per_minute' &&
          entry.key !== 'opt_out.list'
      )
    );
    mockSettingsEntries.push(
      {
        key: 'quiet_hours.rw',
        description: 'Quiet hours window for Rwanda (local time).',
        updatedAt: new Date().toISOString(),
        valuePreview: `${payload.quietHours.start} – ${payload.quietHours.end}`
      },
      {
        key: 'send_throttle.whatsapp.per_minute',
        description: 'Per-minute WhatsApp send cap.',
        updatedAt: new Date().toISOString(),
        valuePreview: String(payload.throttlePerMinute)
      },
      {
        key: 'opt_out.list',
        description: 'List of opted-out MSISDN hashes (mock).',
        updatedAt: new Date().toISOString(),
        valuePreview: JSON.stringify(payload.optOutList)
      }
    );

    await recordAudit({
      actor: 'admin:mock',
      action: 'settings_update',
      targetTable: 'settings',
      targetId: 'platform',
      summary: 'Updated messaging policies'
    });

    const integration =
      supabaseStatus === 'ok'
        ? { target: 'policySettings', status: 'ok' as const }
        : {
            target: 'policySettings',
            status: 'degraded' as const,
            reason: 'mock_store',
            message: 'Supabase not configured or update failed. Settings stored in memory only.'
          };

    return NextResponse.json({ status: 'saved', integration }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_payload', details: error.flatten() }, { status: 400 });
    }
    console.error('Settings update failed', error);
    return NextResponse.json({ error: 'settings_update_failed' }, { status: 500 });
  }
}
