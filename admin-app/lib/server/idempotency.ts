'use server';

import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const memoryStore = new Map<string, unknown>();

export async function withIdempotency<T>(key: string | undefined, action: () => Promise<T>): Promise<T> {
  if (!key) {
    return action();
  }

  const adminClient = getSupabaseAdminClient();
  if (adminClient) {
    try {
      const { data } = await adminClient
        .from('idempotency_keys')
        .select('payload')
        .eq('key', key)
        .maybeSingle();
      if (data?.payload) {
        return data.payload as T;
      }
    } catch (error) {
      console.error('Supabase idempotency lookup failed', error);
    }
  }

  if (memoryStore.has(key)) {
    return memoryStore.get(key) as T;
  }

  const result = await action();

  if (adminClient) {
    try {
      await adminClient
        .from('idempotency_keys')
        .upsert({ key, payload: result, created_at: new Date().toISOString() });
    } catch (error) {
      console.error('Supabase idempotency upsert failed, falling back to memory store', error);
    }
  }

  memoryStore.set(key, result);
  return result;
}
