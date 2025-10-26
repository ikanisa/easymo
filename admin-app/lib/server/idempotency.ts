"use server";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { enqueueReliabilityJob } from "@/lib/server/reliability-queue";

export async function withIdempotency<T>(
  key: string | undefined,
  action: () => Promise<T>,
): Promise<T> {
  if (!key) {
    return action();
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("supabase_admin_unavailable");
  }

  try {
    const { data } = await adminClient
      .from("idempotency_keys")
      .select("payload")
      .eq("key", key)
      .maybeSingle();
    if (data?.payload) {
      return data.payload as T;
    }
  } catch (error) {
    console.error("Supabase idempotency lookup failed", error);
  }

  const result = await action();

  try {
    await adminClient
      .from("idempotency_keys")
      .upsert({ key, payload: result, created_at: new Date().toISOString() });
  } catch (error) {
    console.error(
      "Supabase idempotency upsert failed, enqueuing reliability job",
      error,
    );
    await enqueueReliabilityJob("idempotency.persist", {
      key,
      payload: result,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  return result;
}
