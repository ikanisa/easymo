"use server";

import { logStructured } from "@/lib/server/logger";
import type { ObservabilityContext } from "@/lib/server/observability";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { claimThrottleWindow, type ThrottleWindow } from "@/lib/server/throttle-store";

export interface PolicyResult {
  allowed: boolean;
  reason?: "opt_out" | "quiet_hours" | "throttled";
  message?: string;
  blockedAt?: string;
  throttle?: ThrottleWindow;
}

export interface PolicyEvaluationOptions {
  channel?: string;
  bucketId?: string;
  observability?: ObservabilityContext;
  context?: Record<string, unknown>;
}

async function getSettingsFromSupabase() {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return null;
  try {
    const { data, error } = await adminClient
      .from("settings")
      .select("key, value");
    if (error || !data) {
      console.error("Failed to load settings from Supabase", error);
      return null;
    }
    const map = new Map<string, unknown>();
    for (const entry of data) {
      map.set(entry.key, entry.value);
    }
    return map;
  } catch (error) {
    console.error("Supabase settings fetch failed", error);
    return null;
  }
}

async function fetchPolicySettings() {
  const supabaseSettings = await getSettingsFromSupabase();
  if (supabaseSettings) {
    return {
      quietHours: supabaseSettings.get("quiet_hours.rw") as {
        start: string;
        end: string;
      } | null,
      throttle: supabaseSettings.get("send_throttle.whatsapp.per_minute") as
        | { value?: number }
        | number
        | null,
      optOut: supabaseSettings.get("opt_out.list") as string[] | null,
    };
  }

  // Defaults when settings are unavailable
  return {
    quietHours: { start: "22:00", end: "06:00" },
    throttle: 60,
    optOut: [],
  };
}

function isWithinQuietHours(start: string, end: string) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) return false;
  if (startMinutes < endMinutes) {
    return minutes >= startMinutes && minutes < endMinutes;
  }
  return minutes >= startMinutes || minutes < endMinutes;
}

function msisdnSuffix(msisdn: string) {
  return msisdn.slice(-4);
}

function recordDecision(
  observability: ObservabilityContext | undefined,
  result: PolicyResult,
  channel: string,
  context: Record<string, unknown> = {},
) {
  const tags = {
    allowed: result.allowed ? 1 : 0,
    reason: result.reason ?? "allowed",
    channel,
    ...(result.throttle
      ? {
          throttle_count: result.throttle.count,
          throttle_limit: result.throttle.limit,
          throttle_window_end: result.throttle.windowEnd,
        }
      : {}),
    ...context,
  };

  observability?.recordMetric("policy.outbound.decision", 1, tags);
  observability?.log({
    event: "policy.decision",
    status: result.allowed ? "ok" : "error",
    details: tags,
  });
}

export async function evaluateOutboundPolicy(
  msisdn: string,
  options: PolicyEvaluationOptions = {},
): Promise<PolicyResult> {
  const settings = await fetchPolicySettings();
  const quietHours = settings?.quietHours ?? { start: "22:00", end: "06:00" };
  const optOutList = settings?.optOut ?? [];
  const throttleValue = typeof settings?.throttle === "number"
    ? settings?.throttle
    : settings?.throttle?.value ?? 60;

  const evaluationTime = new Date();
  const blockedAt = evaluationTime.toISOString();
  const channel = options.channel ?? "whatsapp";
  const bucketId = options.bucketId ?? channel;
  const decisionContext = {
    msisdn_suffix: msisdnSuffix(msisdn),
    ...(options.context ?? {}),
  };

  if (Array.isArray(optOutList) && optOutList.includes(msisdn)) {
    const result: PolicyResult = {
      allowed: false,
      reason: "opt_out",
      message: "Recipient opted out of notifications.",
      blockedAt,
    };
    recordDecision(options.observability, result, channel, {
      stage: "opt_out",
      ...decisionContext,
    });
    return result;
  }

  if (isWithinQuietHours(quietHours.start, quietHours.end)) {
    const result: PolicyResult = {
      allowed: false,
      reason: "quiet_hours",
      message:
        "Quiet hours in effect. Try sending outside the restricted window.",
      blockedAt,
    };
    recordDecision(options.observability, result, channel, {
      stage: "quiet_hours",
      quiet_start: quietHours.start,
      quiet_end: quietHours.end,
      ...decisionContext,
    });
    return result;
  }

  let throttleWindow: ThrottleWindow | undefined;
  try {
    throttleWindow = await claimThrottleWindow(bucketId, throttleValue ?? 60);
  } catch (error) {
    logStructured({
      event: "policy_throttle_fallback",
      target: "policy_throttle_counters",
      status: "degraded",
      message: error instanceof Error ? error.message : String(error),
      details: { bucketId, channel },
    });
    options.observability?.recordMetric("policy.outbound.throttle_fallback", 1, {
      channel,
      bucket: bucketId,
    });
  }

  if (throttleWindow && !throttleWindow.allowed) {
    const result: PolicyResult = {
      allowed: false,
      reason: "throttled",
      message: "Per-minute WhatsApp throttle reached.",
      blockedAt,
      throttle: throttleWindow,
    };
    recordDecision(options.observability, result, channel, {
      stage: "throttle",
      ...decisionContext,
    });
    return result;
  }

  const result: PolicyResult = {
    allowed: true,
    throttle: throttleWindow,
  };
  recordDecision(options.observability, result, channel, {
    stage: "allowed",
    throttle_limit: throttleWindow?.limit ?? throttleValue ?? 60,
    throttle_count: throttleWindow?.count ?? 0,
    ...decisionContext,
  });
  return result;
}
