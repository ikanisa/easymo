/**
 * Idempotency Key Validation
 * Prevents duplicate processing of webhook requests
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface IdempotencyResult<T> {
  cached: boolean;
  result: T | null;
}

export async function checkIdempotency<T>(
  supabase: SupabaseClient,
  key: string
): Promise<IdempotencyResult<T>> {
  const { data } = await supabase
    .from("idempotency_keys")
    .select("result")
    .eq("key", key)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (data) {
    return { cached: true, result: data.result as T };
  }
  return { cached: false, result: null };
}

export async function storeIdempotencyResult(
  supabase: SupabaseClient,
  key: string,
  result: unknown,
  ttlSeconds: number = 86400
): Promise<void> {
  await supabase.from("idempotency_keys").upsert({
    key,
    result,
    expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  });
}
