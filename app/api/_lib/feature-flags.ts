import type { SupabaseClient } from '@supabase/supabase-js';

const CACHE = new Map<string, { value: unknown; fetchedAt: number }>();
const CACHE_TTL_MS = 30_000;

export async function getFeatureFlag(client: SupabaseClient, key: string, fallback: unknown = null) {
  const cached = CACHE.get(key);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value ?? fallback;
  }

  const { data, error } = await client
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.error('feature_flag.lookup_failed', { key, error: error.message });
    return fallback;
  }

  const value = data?.value ?? fallback;
  CACHE.set(key, { value, fetchedAt: now });
  return value;
}

export function resolveFeatureEnabled(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  if (value && typeof value === 'object') {
    const record = value as { enabled?: unknown };
    if (typeof record.enabled === 'boolean') {
      return record.enabled;
    }
    if (typeof record.enabled === 'string') {
      const normalized = record.enabled.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
  }
  return fallback;
}
