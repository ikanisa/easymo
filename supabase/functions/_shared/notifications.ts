import type { AnyClient } from "./mod.ts";

// Allow Node-based unit tests to import this module without the Deno global.
// deno-lint-ignore no-explicit-any
declare const Deno: { env?: { get(key: string): string | undefined } } | undefined;

const readEnv = (key: string): string | undefined => {
  if (typeof Deno !== "undefined" && typeof Deno?.env?.get === "function") {
    return Deno.env.get(key) ?? undefined;
  }
  if (typeof process !== "undefined" && typeof process.env === "object") {
    return process.env[key] ?? undefined;
  }
  return undefined;
};

export type NotificationChannel = "WHATSAPP" | "EMAIL";

export interface NotificationJob {
  id: string;
  event: string;
  channel: NotificationChannel;
  sacco_id: string | null;
  template_id: string | null;
  payment_id: string | null;
  status: string;
  scheduled_for: string;
  created_at: string;
  processed_at: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  last_error: string | null;
  last_attempt_at: string | null;
  retry_after: string | null;
}

const MAX_ATTEMPTS = Number(readEnv("NOTIFICATION_MAX_ATTEMPTS") ?? "5");
const MAX_ATTEMPTS_CLAMP = Number.isFinite(MAX_ATTEMPTS) && MAX_ATTEMPTS > 0 ? MAX_ATTEMPTS : 5;

export const getMaxNotificationAttempts = () => MAX_ATTEMPTS_CLAMP;

export const computeRetryDelaySeconds = (attempt: number) => {
  const safeAttempt = Math.max(1, attempt);
  const base = Math.pow(2, safeAttempt - 1) * 30; // 30s, 60s, 120s, 240s, ...
  return Math.min(base, 3600); // clamp to 1h
};

export const computeNextRetryAt = (attempt: number, now = new Date()) => {
  const delaySeconds = computeRetryDelaySeconds(attempt);
  const retryAt = new Date(now.getTime() + delaySeconds * 1000);
  return retryAt;
};

const parsePayload = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch (error) {
      console.warn("notification_queue.payload_parse_failed", { error });
    }
  }

  return {};
};

interface ClaimOptions {
  limit?: number;
}

export const claimNotificationJobs = async (
  supabase: AnyClient,
  channel: NotificationChannel,
  options: ClaimOptions = {}
): Promise<NotificationJob[]> => {
  const limit = Math.max(1, Math.min(options.limit ?? 10, 25));
  const nowIso = new Date().toISOString();

  const baseSelect =
    "id,event,channel,sacco_id,template_id,payment_id,status,scheduled_for,created_at,processed_at,payload,attempts,last_error,last_attempt_at,retry_after";

  const { data: pending, error } = await supabase
    .from("notification_queue")
    .select(baseSelect)
    .eq("channel", channel)
    .eq("status", "PENDING")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const claimed: NotificationJob[] = [];

  for (const row of pending ?? []) {
    const { data: updated, error: updateError } = await supabase
      .from("notification_queue")
      .update({
        status: "PROCESSING",
        attempts: (row.attempts ?? 0) + 1,
        last_attempt_at: nowIso,
      })
      .eq("id", row.id)
      .eq("status", "PENDING")
      .select(baseSelect)
      .single();

    if (updateError) {
      console.warn("notification_queue.claim_failed", { id: row.id, error: updateError.message });
      continue;
    }

    if (!updated) continue;

    claimed.push({
      id: updated.id,
      event: updated.event,
      channel: updated.channel as NotificationChannel,
      sacco_id: updated.sacco_id,
      template_id: updated.template_id,
      payment_id: updated.payment_id,
      status: updated.status,
      scheduled_for: updated.scheduled_for,
      created_at: updated.created_at,
      processed_at: updated.processed_at,
      payload: parsePayload(updated.payload),
      attempts: updated.attempts ?? 0,
      last_error: updated.last_error ?? null,
      last_attempt_at: updated.last_attempt_at ?? null,
      retry_after: updated.retry_after ?? null,
    });
  }

  return claimed;
};

export const markJobDelivered = async (supabase: AnyClient, jobId: string) => {
  const nowIso = new Date().toISOString();
  await supabase
    .from("notification_queue")
    .update({
      status: "DELIVERED",
      processed_at: nowIso,
      last_error: null,
      retry_after: null,
    })
    .eq("id", jobId);
};

export const markJobFailed = async (supabase: AnyClient, jobId: string, reason: string) => {
  const nowIso = new Date().toISOString();
  await supabase
    .from("notification_queue")
    .update({
      status: "FAILED",
      processed_at: nowIso,
      last_error: reason,
      retry_after: null,
    })
    .eq("id", jobId);
};

export const scheduleJobRetry = async (
  supabase: AnyClient,
  jobId: string,
  retryAt: Date,
  reason: string
) => {
  await supabase
    .from("notification_queue")
    .update({
      status: "PENDING",
      scheduled_for: retryAt.toISOString(),
      retry_after: retryAt.toISOString(),
      last_error: reason,
    })
    .eq("id", jobId);
};

const tokenPattern = /\{([a-zA-Z0-9_]+)\}/g;

export const renderTemplate = (
  body: string,
  tokens: Record<string, string | number | null | undefined>
) => {
  return body.replace(tokenPattern, (_, key: string) => {
    const replacement = tokens[key];
    if (replacement === null || replacement === undefined) {
      return `{${key}}`;
    }
    return String(replacement);
  });
};

export const normalizeMsisdn = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith("whatsapp:")) {
    return trimmed.replace(/^whatsapp:/, "");
  }
  if (trimmed.startsWith("+")) {
    return trimmed;
  }
  if (trimmed.startsWith("2507")) {
    return `+${trimmed}`;
  }
  if (trimmed.startsWith("07")) {
    return `+250${trimmed.slice(2)}`;
  }
  return trimmed;
};
