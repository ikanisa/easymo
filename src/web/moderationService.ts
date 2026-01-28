import { getWebSupabaseClient } from "./client";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // one hour window
const MAX_POSTS_PER_WINDOW = 3;
const BLOCK_DURATION_MS = 30 * 60 * 1000; // block for 30 minutes when throttled

export type ModerationSeverity = "low" | "medium" | "high";

export async function ensureSessionCanPost(sessionId: string): Promise<void> {
  const client = getWebSupabaseClient();
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const { count, error } = await client
    .from("market_posts")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .gte("created_at", since);

  if (error) {
    throw new Error(`post_rate_count_failed:${error.message}`);
  }

  const currentCount = count ?? 0;
  if (currentCount >= MAX_POSTS_PER_WINDOW) {
    const blockedUntil = new Date(Date.now() + BLOCK_DURATION_MS).toISOString();
    await recordModerationEvent({
      session_id: sessionId,
      event_type: "rate_limit_exceeded",
      reason: "session exceeded anonymous post rate limit",
      severity: "medium",
      blocked_until: blockedUntil,
    });
    throw new Error("rate_limit_exceeded");
  }
}

export type RecordModerationEventInput = {
  session_id: string;
  post_id?: string;
  event_type: string;
  reason: string;
  severity: ModerationSeverity;
  blocked_until?: string;
  metadata?: Record<string, unknown>;
};

export async function recordModerationEvent(input: RecordModerationEventInput) {
  const client = getWebSupabaseClient();
  const payload = {
    session_id: input.session_id,
    post_id: input.post_id ?? null,
    event_type: input.event_type,
    reason: input.reason,
    severity: input.severity,
    blocked_until: input.blocked_until ?? null,
    metadata: input.metadata ?? {},
  };

  const { error } = await client.from("moderation_events").insert(payload);
  if (error) {
    throw new Error(`moderation_event_insert_failed:${error.message}`);
  }
}

export async function checkSessionBlocked(sessionId: string): Promise<{ blocked: boolean; until?: string }> {
  const client = getWebSupabaseClient();
  const { data, error } = await client
    .from("moderation_events")
    .select("blocked_until")
    .eq("session_id", sessionId)
    .order("created_at", { descending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`moderation_lookup_failed:${error.message}`);
  }

  const blockedUntil = data?.blocked_until;
  if (!blockedUntil) return { blocked: false };

  const now = new Date();
  if (new Date(blockedUntil) > now) {
    return { blocked: true, until: blockedUntil };
  }

  return { blocked: false };
}
