/**
 * Enhanced Notification Processing with Filters
 * Integrates quiet hours, opt-out, and rate limiting
 * Ground Rules Compliance: Structured logging, security, observability
 */

import type { SupabaseClient } from "../deps.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { recordMetric } from "../observe/metrics.ts";
import {
  applyNotificationFilters,
  checkRateLimit,
  ensureContactPreferences,
  type FilterResult,
} from "./filters.ts";

type ClaimedRow = {
  id: string;
  to_wa_id: string;
  payload?: unknown;
  notification_type?: string | null;
  retry_count?: number | null;
};

/**
 * Process notification with filters before delivery
 * Returns true if notification should be delivered, false if deferred/blocked
 */
export async function processNotificationWithFilters(
  row: ClaimedRow,
  supa: SupabaseClient,
): Promise<{ shouldDeliver: boolean; reason?: string; deferUntil?: Date }> {
  // Ensure contact preferences exist (fail-safe)
  await ensureContactPreferences(supa, row.to_wa_id);
  const payloadMeta = extractMeta(row.payload);

  // Apply core filters (opt-out, quiet hours)
  const filterResult = await applyNotificationFilters(supa, {
    to_wa_id: row.to_wa_id,
    quiet_hours_override: Boolean(payloadMeta?.quiet_hours_override),
  });

  if (!filterResult.allowed) {
    await handleFilterBlock(row, supa, filterResult);
    return {
      shouldDeliver: false,
      reason: filterResult.reason,
      deferUntil: filterResult.defer_until,
    };
  }

  // Apply rate limiting (soft check - log but allow)
  const rateLimitResult = await checkRateLimit(supa, row.to_wa_id, 60, 20);
  if (!rateLimitResult.allowed) {
    // Log but don't block (soft limit)
    await logStructuredEvent("NOTIFY_RATE_LIMIT_WARNING", {
      id: row.id,
      to: maskWa(row.to_wa_id),
      reason: rateLimitResult.reason,
    });
  }

  return { shouldDeliver: true };
}

/**
 * Handle notification blocked by filters
 */
async function handleFilterBlock(
  row: ClaimedRow,
  supa: SupabaseClient,
  result: FilterResult,
): Promise<void> {
  const updatePayload: Record<string, unknown> = {};
  const metaPatch: Record<string, unknown> = {};
  const domain = row.notification_type ?? "unknown";

  if (result.reason === "contact_opted_out") {
    // Permanently fail opted-out notifications
    updatePayload.status = "failed";
    updatePayload.error_message = "Contact has opted out";
    updatePayload.next_attempt_at = null;
    metaPatch.last_status = "failed";
    metaPatch.last_error_code = "opted_out";

    await logStructuredEvent("NOTIFY_FAILED_OPTOUT", {
      id: row.id,
      to: maskWa(row.to_wa_id),
    });
    await recordMetric("notification_blocked_optout", 1, { domain });
  } else if (result.reason === "quiet_hours" && result.defer_until) {
    // Defer to after quiet hours
    updatePayload.status = "queued";
    updatePayload.next_attempt_at = result.defer_until.toISOString();
    updatePayload.error_message = "Deferred due to quiet hours";
    metaPatch.last_status = "queued";
    metaPatch.last_error_code = "quiet_hours";

    await logStructuredEvent("NOTIFY_DEFERRED_QUIET_HOURS", {
      id: row.id,
      to: maskWa(row.to_wa_id),
      defer_until: result.defer_until.toISOString(),
    });
    await recordMetric("notification_deferred_quiet_hours", 1, { domain });
  } else if (result.reason === "rate_limit_exceeded") {
    // Defer by 1 hour for rate limit
    const deferUntil = new Date(Date.now() + 3600 * 1000);
    updatePayload.status = "queued";
    updatePayload.next_attempt_at = deferUntil.toISOString();
    updatePayload.error_message = "Rate limit exceeded";
    metaPatch.last_status = "queued";
    metaPatch.last_error_code = "rate_limit";

    await logStructuredEvent("NOTIFY_DEFERRED_RATE_LIMIT", {
      id: row.id,
      to: maskWa(row.to_wa_id),
      defer_until: deferUntil.toISOString(),
    });
    await recordMetric("notification_deferred_rate_limit", 1, { domain });
  }

  if (Object.keys(updatePayload).length > 0) {
    if (Object.keys(metaPatch).length > 0) {
      updatePayload.payload = mergeMeta(row.payload, metaPatch);
    }
    await supa
      .from("notifications")
      .update(updatePayload)
      .eq("id", row.id);

    // Log to audit log
    try {
      await supa.rpc("log_notification_event", {
        p_notification_id: row.id,
        p_event_type: result.reason === "contact_opted_out"
          ? "blocked_optout"
          : result.reason === "quiet_hours"
          ? "deferred_quiet_hours"
          : "deferred_rate_limit",
        p_details: {
          reason: result.reason,
          defer_until: result.defer_until?.toISOString(),
        },
      });
    } catch (err) {
      console.error("audit_log_error", err);
    }
  }
}

/**
 * Extract Meta error code from WhatsApp API error response
 */
export function extractMetaErrorCode(errorDetail: unknown): string | null {
  if (!errorDetail || typeof errorDetail !== "object") return null;

  const detail = errorDetail as Record<string, unknown>;
  const error = detail.error as Record<string, unknown> | undefined;

  if (error?.code) {
    return String(error.code);
  }

  // Check for nested error structure
  if (detail.code) {
    return String(detail.code);
  }

  return null;
}

/**
 * Categorize Meta error codes for retry logic
 */
export function categorizeMetaError(
  errorCode: string | null,
): "retry" | "fail" | "defer" {
  if (!errorCode) return "retry";

  const code = Number(errorCode);

  // Rate limit errors - defer with longer backoff
  if (code === 131047 || code === 80007) {
    return "defer";
  }

  // Invalid payload, opt-out, policy violation - fail immediately
  if (
    code === 131000 || // Payload not found
    code === 131026 || // Payload paused
    code === 131047 || // Rate limit
    code === 131051 || // Unsupported message type
    code === 132000 || // Temporary ban
    code === 133016 || // Expired session
    code === 135000 // Account restricted
  ) {
    return "fail";
  }

  // Network/temporary errors - retry
  return "retry";
}

/**
 * Calculate backoff time for rate limit errors
 */
export function calculateRateLimitBackoff(
  errorCode: string | null,
  retryCount: number,
): number {
  if (errorCode === "131047") {
    // Meta rate limit - longer backoff
    return Math.min(3600, 300 * Math.pow(2, retryCount)); // Start at 5 min, cap at 1 hour
  }

  // Standard exponential backoff
  return Math.min(900, 30 * Math.pow(2, retryCount)); // Start at 30s, cap at 15 min
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Mask WhatsApp ID for logging (PII protection)
 */
function maskWa(wa: string): string {
  if (wa.length <= 4) return "***";
  return `${wa.slice(0, 2)}***${wa.slice(-2)}`;
}

/**
 * Get preferred locale for notification
 */
export async function getNotificationLocale(
  supa: SupabaseClient,
  wa_id: string,
  fallback: string = "en",
): Promise<string> {
  try {
    const { data, error } = await supa.rpc("get_contact_locale", {
      p_wa_id: wa_id,
      p_fallback: fallback,
    });

    if (error) {
      console.error("get_locale_error", error);
      return fallback;
    }

    return data ?? fallback;
  } catch (error) {
    console.error("get_locale_exception", error);
    return fallback;
  }
}

/**
 * Log notification delivery metrics by domain and message format
 */
export async function logDeliveryMetrics(
  row: ClaimedRow,
  status: "sent" | "failed" | "deferred",
  errorCode?: string | null,
): Promise<void> {
  const domain = row.notification_type ?? "unknown";

  await recordMetric(`notification_${status}`, 1, {
    domain,
    error_code: errorCode ?? "none",
  });

  // Track per-domain success rate
  if (status === "sent") {
    await recordMetric("notification_success_rate", 100, { domain });
  } else if (status === "failed") {
    await recordMetric("notification_success_rate", 0, { domain });
  }
}

function extractMeta(
  payload: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(payload)) return undefined;
  if (isRecord(payload.meta)) return payload.meta;
  if (isRecord(payload.message) && isRecord(payload.message.meta)) {
    return payload.message.meta;
  }
  return undefined;
}

function mergeMeta(
  payload: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base: Record<string, unknown> = isRecord(payload)
    ? { ...(payload as Record<string, unknown>) }
    : {};
  const currentMeta = extractMeta(payload) ?? {};
  base.meta = { ...currentMeta, ...patch };
  return base;
}
