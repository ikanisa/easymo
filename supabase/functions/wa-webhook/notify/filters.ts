/**
 * Notification Filters - Quiet Hours, Opt-out, and Policy Enforcement
 * Ground Rules Compliance: Structured logging and security
 */

import type { SupabaseClient } from "../deps.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { recordMetric } from "../observe/metrics.ts";

export type FilterResult = {
  allowed: boolean;
  reason?: string;
  defer_until?: Date;
};

export type NotificationFilter = {
  to_wa_id: string;
  quiet_hours_override?: boolean;
};

/**
 * Check if contact has opted out of notifications
 */
export async function checkOptOut(
  supa: SupabaseClient,
  wa_id: string,
): Promise<FilterResult> {
  try {
    const { data, error } = await supa.rpc("is_opted_out", { p_wa_id: wa_id });

    if (error) {
      console.error("opt_out_check_error", error);
      // Fail open - allow send if we can't check
      return { allowed: true };
    }

    if (data === true) {
      await logStructuredEvent("NOTIFY_BLOCKED_OPTOUT", {
        to: maskWa(wa_id),
      });
      await recordMetric("notification_filtered_optout", 1, { reason: "opted_out" });
      return { allowed: false, reason: "contact_opted_out" };
    }

    return { allowed: true };
  } catch (error) {
    console.error("opt_out_check_exception", error);
    // Fail open
    return { allowed: true };
  }
}

/**
 * Check if current time is within contact's quiet hours
 */
export async function checkQuietHours(
  supa: SupabaseClient,
  wa_id: string,
  override: boolean = false,
): Promise<FilterResult> {
  if (override) {
    await logStructuredEvent("NOTIFY_QUIET_HOURS_OVERRIDE", {
      to: maskWa(wa_id),
    });
    return { allowed: true };
  }

  try {
    const { data, error } = await supa.rpc("is_in_quiet_hours", {
      p_wa_id: wa_id,
      p_check_time: new Date().toISOString(),
    });

    if (error) {
      console.error("quiet_hours_check_error", error);
      // Fail open - allow send if we can't check
      return { allowed: true };
    }

    if (data === true) {
      // Calculate when quiet hours end
      const deferUntil = await calculateQuietHoursEnd(supa, wa_id);
      
      await logStructuredEvent("NOTIFY_DEFERRED_QUIET_HOURS", {
        to: maskWa(wa_id),
        defer_until: deferUntil?.toISOString(),
      });
      await recordMetric("notification_filtered_quiet_hours", 1, { reason: "quiet_hours" });
      
      return {
        allowed: false,
        reason: "quiet_hours",
        defer_until: deferUntil,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("quiet_hours_check_exception", error);
    // Fail open
    return { allowed: true };
  }
}

/**
 * Calculate when quiet hours end for a contact
 */
async function calculateQuietHoursEnd(
  supa: SupabaseClient,
  wa_id: string,
): Promise<Date | undefined> {
  try {
    const { data, error } = await supa
      .from("contact_preferences")
      .select("quiet_hours_end, timezone")
      .eq("wa_id", wa_id)
      .single();

    if (error || !data?.quiet_hours_end) {
      return undefined;
    }

    // Parse the time and create a Date for today/tomorrow in contact's timezone
    const timezone = data.timezone || "Africa/Kigali";
    const now = new Date();
    
    // Simple calculation - add time until quiet hours end
    // This is a simplified version; production would use proper timezone handling
    const [hours, minutes] = data.quiet_hours_end.split(":").map(Number);
    const endTime = new Date(now);
    endTime.setHours(hours, minutes, 0, 0);
    
    // If end time is in the past today, it must be tomorrow
    if (endTime < now) {
      endTime.setDate(endTime.getDate() + 1);
    }
    
    return endTime;
  } catch (error) {
    console.error("calculate_quiet_hours_end_error", error);
    return undefined;
  }
}

/**
 * Apply all notification filters
 */
export async function applyNotificationFilters(
  supa: SupabaseClient,
  notification: NotificationFilter,
): Promise<FilterResult> {
  const { to_wa_id, quiet_hours_override } = notification;

  // Check opt-out first (hard block)
  const optOutResult = await checkOptOut(supa, to_wa_id);
  if (!optOutResult.allowed) {
    return optOutResult;
  }

  // Check quiet hours (can be overridden)
  const quietHoursResult = await checkQuietHours(
    supa,
    to_wa_id,
    quiet_hours_override ?? false,
  );
  if (!quietHoursResult.allowed) {
    return quietHoursResult;
  }

  return { allowed: true };
}

/**
 * Mask WhatsApp ID for logging (PII protection)
 */
function maskWa(wa: string): string {
  if (wa.length <= 4) return "***";
  return `${wa.slice(0, 2)}***${wa.slice(-2)}`;
}

/**
 * Check if notification should be rate limited
 * Simple implementation - can be enhanced with Redis
 */
export async function checkRateLimit(
  supa: SupabaseClient,
  wa_id: string,
  window_minutes: number = 60,
  max_count: number = 20,
): Promise<FilterResult> {
  try {
    const since = new Date(Date.now() - window_minutes * 60 * 1000).toISOString();
    
    const { count, error } = await supa
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("to_wa_id", wa_id)
      .gte("created_at", since);

    if (error) {
      console.error("rate_limit_check_error", error);
      return { allowed: true };
    }

    if ((count ?? 0) >= max_count) {
      await logStructuredEvent("NOTIFY_BLOCKED_RATE_LIMIT", {
        to: maskWa(wa_id),
        count,
        window_minutes,
        max_count,
      });
      await recordMetric("notification_filtered_rate_limit", 1, { reason: "rate_limited" });
      return { allowed: false, reason: "rate_limit_exceeded" };
    }

    return { allowed: true };
  } catch (error) {
    console.error("rate_limit_check_exception", error);
    return { allowed: true };
  }
}

/**
 * Initialize contact preferences if they don't exist
 */
export async function ensureContactPreferences(
  supa: SupabaseClient,
  wa_id: string,
  profile_id?: string | null,
  locale?: string,
): Promise<void> {
  try {
    await supa.rpc("init_contact_preferences", {
      p_wa_id: wa_id,
      p_profile_id: profile_id,
      p_locale: locale ?? "en",
    });
  } catch (error) {
    console.error("init_contact_preferences_error", error);
    // Non-fatal - continue with notification
  }
}
