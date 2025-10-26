"use server";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { logStructured } from "@/lib/server/logger";

const WINDOW_MS = 60_000;

export interface ThrottleWindow {
  allowed: boolean;
  count: number;
  limit: number;
  windowStart: string;
  windowEnd: string;
}

const MAX_ATTEMPTS = 3;

function truncateToWindow(now: Date): { windowStart: string; windowEnd: string } {
  const startMs = Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS;
  const endMs = startMs + WINDOW_MS;
  return {
    windowStart: new Date(startMs).toISOString(),
    windowEnd: new Date(endMs).toISOString(),
  };
}

export async function claimThrottleWindow(
  bucketId: string,
  limit: number,
  now: Date = new Date(),
): Promise<ThrottleWindow> {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("supabase_admin_unavailable");
  }

  const { windowStart, windowEnd } = truncateToWindow(now);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const lookup = await adminClient
      .from("policy_throttle_counters")
      .select("count, limit")
      .eq("bucket_id", bucketId)
      .eq("window_start", windowStart)
      .maybeSingle();

    if (lookup.error && lookup.error.code !== "PGRST116") {
      throw new Error(`throttle_lookup_failed:${lookup.error.message}`);
    }

    if (!lookup.data) {
      const insert = await adminClient
        .from("policy_throttle_counters")
        .insert({
          bucket_id: bucketId,
          window_start: windowStart,
          count: 1,
          limit,
          expires_at: windowEnd,
        })
        .select("count, limit")
        .maybeSingle();

      if (!insert.error && insert.data) {
        return {
          allowed: true,
          count: insert.data.count ?? 1,
          limit: insert.data.limit ?? limit,
          windowStart,
          windowEnd,
        };
      }

      if (insert.error?.code === "23505") {
        // Conflict because another request inserted concurrently; retry.
        continue;
      }

      throw new Error(`throttle_insert_failed:${insert.error?.message ?? "unknown"}`);
    }

    const currentCount = lookup.data.count ?? 0;
    const currentLimit = lookup.data.limit ?? limit;

    if (currentLimit > 0 && currentCount >= currentLimit) {
      return {
        allowed: false,
        count: currentCount,
        limit: currentLimit,
        windowStart,
        windowEnd,
      };
    }

    const nextCount = currentCount + 1;
    const update = await adminClient
      .from("policy_throttle_counters")
      .update({
        count: nextCount,
        limit,
        expires_at: windowEnd,
      })
      .eq("bucket_id", bucketId)
      .eq("window_start", windowStart)
      .eq("count", currentCount)
      .select("count, limit")
      .maybeSingle();

    if (!update.error && update.data) {
      return {
        allowed: true,
        count: update.data.count ?? nextCount,
        limit: update.data.limit ?? limit,
        windowStart,
        windowEnd,
      };
    }

    if (update.error?.code === "PGRST116") {
      // Row changed since lookup; retry.
      continue;
    }

    throw new Error(`throttle_update_failed:${update.error?.message ?? "unknown"}`);
  }

  logStructured({
    event: "throttle_window_conflict",
    target: "policy_throttle_counters",
    status: "degraded",
    message: "Exceeded max retries while updating throttle counter.",
    details: { bucketId, limit },
  });

  return {
    allowed: true,
    count: 0,
    limit,
    windowStart,
    windowEnd,
  };
}
