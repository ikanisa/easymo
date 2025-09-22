'use server';

import { mockSettingsEntries } from '@/lib/mock-data';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

interface PolicyResult {
  allowed: boolean;
  reason?: 'opt_out' | 'quiet_hours' | 'throttled';
  message?: string;
}

const throttleBucket = new Map<string, { count: number; windowStart: number; limit: number }>();

async function getSettingsFromSupabase() {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return null;
  try {
    const { data, error } = await adminClient
      .from('settings')
      .select('key, value');
    if (error || !data) {
      console.error('Failed to load settings from Supabase', error);
      return null;
    }
    const map = new Map<string, unknown>();
    for (const entry of data) {
      map.set(entry.key, entry.value);
    }
    return map;
  } catch (error) {
    console.error('Supabase settings fetch failed', error);
    return null;
  }
}

async function fetchPolicySettings() {
  const supabaseSettings = await getSettingsFromSupabase();
  if (supabaseSettings) {
    return {
      quietHours: supabaseSettings.get('quiet_hours.rw') as { start: string; end: string } | null,
      throttle: supabaseSettings.get('send_throttle.whatsapp.per_minute') as { value?: number } | number | null,
      optOut: supabaseSettings.get('opt_out.list') as string[] | null
    };
  }

  const quiet = mockSettingsEntries.find((entry) => entry.key === 'quiet_hours.rw');
  const throttle = mockSettingsEntries.find((entry) => entry.key === 'send_throttle.whatsapp.per_minute');
  const optOut = mockSettingsEntries.find((entry) => entry.key === 'opt_out.list');
  return {
    quietHours: quiet
      ? (() => {
          const parts = quiet.valuePreview.split('–').map((value) => value.trim());
          return { start: parts[0] ?? '22:00', end: parts[1] ?? '06:00' };
        })()
      : { start: '22:00', end: '06:00' },
    throttle: throttle ? Number(throttle.valuePreview) : 60,
    optOut: optOut ? JSON.parse(optOut.valuePreview) : []
  };
}

function isWithinQuietHours(start: string, end: string) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) return false;
  if (startMinutes < endMinutes) {
    return minutes >= startMinutes && minutes < endMinutes;
  }
  return minutes >= startMinutes || minutes < endMinutes;
}

function isThrottled(bucketId: string, limitPerMinute: number) {
  const now = Date.now();
  const bucket = throttleBucket.get(bucketId);
  if (!bucket || now - bucket.windowStart > 60_000) {
    throttleBucket.set(bucketId, { count: 1, windowStart: now, limit: limitPerMinute });
    return false;
  }
  if (bucket.count >= bucket.limit) {
    return true;
  }
  bucket.count += 1;
  return false;
}

export async function evaluateOutboundPolicy(msisdn: string): Promise<PolicyResult> {
  const settings = await fetchPolicySettings();
  const quietHours = settings?.quietHours ?? { start: '22:00', end: '06:00' };
  const optOutList = settings?.optOut ?? [];
  const throttleValue = typeof settings?.throttle === 'number' ? settings?.throttle : settings?.throttle?.value ?? 60;

  if (Array.isArray(optOutList) && optOutList.includes(msisdn)) {
    return {
      allowed: false,
      reason: 'opt_out',
      message: 'Recipient opted out of notifications.'
    };
  }

  if (isWithinQuietHours(quietHours.start, quietHours.end)) {
    return {
      allowed: false,
      reason: 'quiet_hours',
      message: 'Quiet hours in effect. Try sending outside the restricted window.'
    };
  }

  if (isThrottled('whatsapp', throttleValue ?? 60)) {
    return {
      allowed: false,
      reason: 'throttled',
      message: 'Per-minute WhatsApp throttle reached.'
    };
  }

  return { allowed: true };
}
