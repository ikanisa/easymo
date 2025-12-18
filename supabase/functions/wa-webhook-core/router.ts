/// <reference types="https://deno.land/x/types/index.d.ts" />
/// <reference lib="deno.ns" />

// Allow Node-based unit tests to import this module without the Deno global.
// deno-lint-ignore no-explicit-any
declare const Deno: { env?: { get(key: string): string | undefined } } | undefined;

import { getRoutingText } from "../_shared/wa-webhook-shared/utils/messages.ts";
import type { WhatsAppWebhookPayload, RouterContext, WhatsAppMessage, WhatsAppCallEvent } from "../_shared/wa-webhook-shared/types.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { supabase } from "../_shared/wa-webhook-shared/config.ts";
import type { SupabaseClient } from "../_shared/wa-webhook-shared/deps.ts";
import { getFirstMessage } from "./utils/message-extraction.ts";
import {
  clearActiveService,
  getSessionByPhone,
  setActiveService,
  touchSession,
} from "../_shared/session-manager.ts";
import {
  isServiceCircuitOpen,
  recordServiceSuccess,
  recordServiceFailure,
  fetchWithRetry,
  getAllCircuitStates,
} from "../_shared/service-resilience.ts";
import { addToDeadLetterQueue } from "../_shared/dead-letter-queue.ts";
import { circuitBreakerManager } from "../_shared/circuit-breaker.ts";
import { logError, logWarn, logInfo } from "../_shared/correlation-logging.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import {
  buildMenuKeyMap,
  ROUTED_SERVICES,
} from "../_shared/route-config.ts";
import { handleInsuranceAgentRequest } from "./handlers/insurance.ts";

type RoutingDecision = {
  service: string;
  reason: "keyword" | "state" | "fallback" | "home_menu";
  routingText?: string | null;
};

type HealthStatus = {
  status: "healthy" | "unhealthy";
  service: "wa-webhook-core";
  timestamp: string;
  checks: Record<string, string>;
  microservices: Record<string, boolean>;
  circuitBreakers?: Record<string, { state: string; failures: number }>;
  version: string;
  error?: string;
};

// WhatsAppHomeMenuItem type moved to handlers/home-menu.ts


// Build SERVICE_KEY_MAP from consolidated route config
const SERVICE_KEY_MAP = buildMenuKeyMap();

/**
 * Handle insurance agent request - dynamically fetch contacts from insurance_admin_contacts table
 * Simple 2-step flow: User taps insurance → Get contacts → Send message with contact numbers
 */
// Helper function for safe Deno.env access
const getEnvValue = (key: string): string | undefined => {
  return typeof Deno !== "undefined" && Deno?.env?.get ? Deno.env.get(key) : undefined;
};

// Constants
const MICROSERVICES_BASE_URL = `${getEnvValue("SUPABASE_URL") ?? ""}/functions/v1`;
const ROUTER_TIMEOUT_MS = Math.max(Number(getEnvValue("WA_ROUTER_TIMEOUT_MS") ?? "4000") || 4000, 1000);

function extractReferralCode(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const explicit = trimmed.match(
    /^(?:EASYMO\s+)?REF[:\s]+([A-Z0-9]{4,12})$/i,
  );
  if (explicit) return explicit[1].toUpperCase();

  const upper = trimmed.toUpperCase();
  // Standalone codes must include BOTH letters and digits to avoid false positives ("RESTAURANT", etc.)
  if (/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{6,12}$/.test(upper)) return upper;

  return null;
}

function isHomeCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return /^(hi|hello|hey|hola|bonjour|menu|home|exit|start|help|\?)$/i.test(
    normalized,
  ) || normalized === "menu" || normalized === "home" || normalized === "exit";
}

function normalizePhoneDigits(raw: string): { digits: string; e164: string } | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  return { digits, e164: `+${digits}` };
}

async function isExistingUser(phoneNumber: string): Promise<boolean> {
  const normalized = normalizePhoneDigits(phoneNumber);
  if (!normalized) return false;

  try {
    // Prefer profiles check (fast path)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .or(
        [
          `wa_id.eq.${normalized.digits}`,
          `wa_id.eq.${normalized.e164}`,
          `phone_number.eq.${normalized.digits}`,
          `phone_number.eq.${normalized.e164}`,
        ].join(","),
      )
      .limit(1)
      .maybeSingle();

    if (!profileError && profile?.user_id) return true;
  } catch {
    // best-effort; fall through to auth check
  }

  try {
    // Some users may exist in auth without a profile row yet
    const { data: authUser, error: authError } = await supabase
      .schema("auth")
      .from("users")
      .select("id")
      .eq("phone", normalized.e164)
      .limit(1)
      .maybeSingle();

    if (!authError && authUser?.id) return true;
  } catch {
    // ignore
  }

  return false;
}

export async function routeIncomingPayload(payload: WhatsAppWebhookPayload): Promise<RoutingDecision> {
  const routingMessage = getFirstMessage(payload);

  const routingText = routingMessage ? getRoutingText(routingMessage) : null;
  const phoneNumber = routingMessage?.from ?? null;
  const messageType = routingMessage?.type ?? null;
  const isInteractive = messageType === "interactive";
  const isText = messageType === "text";
  let session:
    | Awaited<ReturnType<typeof getSessionByPhone>>
    | null = null;
  let sessionLoaded = false;
  const loadSession = async () => {
    if (sessionLoaded) return session;
    sessionLoaded = true;
    if (!phoneNumber) return null;
    session = await getSessionByPhone(supabase, phoneNumber);
    return session;
  };

  // Load session BEFORE checking first message to avoid race conditions
  const currentSession = phoneNumber ? await loadSession() : null;
  
  // Determine if this is truly the first message (no existing session)
  const isFirstMessage = Boolean(phoneNumber) && !currentSession;

  // Text: "menu/home/exit/hello" -> always go back to core home menu (and clear active service)
  if (isText && routingText && isHomeCommand(routingText)) {
    if (phoneNumber) {
      await clearActiveService(supabase, phoneNumber);
      await touchSession(supabase, phoneNumber);
    }
    return {
      service: "wa-webhook-core",
      reason: "home_menu",
      routingText,
    };
  }

  // Interactive: route via menu IDs only (keeps services separate from free-text typing)
  if (isInteractive && routingText) {
    const normalized = routingText.trim().toLowerCase();
    const target = SERVICE_KEY_MAP[normalized];
    if (target) {
      if (phoneNumber) {
        await setActiveService(supabase, phoneNumber, target);
        await touchSession(supabase, phoneNumber);
      }
      return {
        service: target,
        reason: "keyword",
        routingText,
      };
    }
  }

  // PRIORITY: If user is already in a service, keep routing ALL subsequent messages there
  // This ensures Buy & Sell AI agent captures ANY word when user is in conversation
  if (phoneNumber && currentSession?.active_service) {
    const active = currentSession.active_service;
    if (ROUTED_SERVICES.includes(active)) {
      // Ensure session is touched to keep it alive
      await touchSession(supabase, phoneNumber);
      return {
        service: active,
        reason: "state",
        routingText,
      };
    }
  }

  // Text: referral codes ONLY for truly new users AND only on their FIRST ever message
  // CRITICAL: If NOT first message, NEVER check for referral codes (all text is ignored for referral)
  if (isText && routingText && phoneNumber && isFirstMessage) {
    // Check if user is new before processing referral code
    const existing = await isExistingUser(phoneNumber);
    if (!existing) {
      // Only check for referral codes if user is NEW and this is their FIRST message
      const code = extractReferralCode(routingText);
      if (code) {
        logInfo(
          "WA_CORE_REFERRAL_CODE_DETECTED",
          { code: `${code.substring(0, 8)}***`, from: phoneNumber.substring(0, 6) },
          { correlationId: crypto.randomUUID() },
        );
        // Create session after referral code detection but before routing
        await touchSession(supabase, phoneNumber);
        return {
          service: "wa-webhook-profile",
          reason: "keyword",
          routingText,
        };
      }
    }
    // If first message but no referral code or existing user, create session and continue
    await touchSession(supabase, phoneNumber);
  } else {
    // Not first message - ensure session exists
    if (phoneNumber) {
      await touchSession(supabase, phoneNumber);
    }
  }

  // Default: show home menu/welcome message for any unrecognized text
  // This handles cases where user sends any text that doesn't match keywords
  return {
    service: "wa-webhook-core",
    reason: "home_menu",
    routingText,
  };
}

export async function forwardToEdgeService(
  decision: RoutingDecision,
  payload: WhatsAppWebhookPayload,
  headers?: Headers,
): Promise<Response> {
  // Declare correlationId first before any usage
  const correlationId = headers?.get("X-Correlation-ID") ?? crypto.randomUUID();
  
  const targetService = decision.service;
  
  if (!ROUTED_SERVICES.includes(targetService)) {
    logWarn("WA_CORE_UNKNOWN_SERVICE", { 
      service: targetService,
      handlingInCore: true 
    }, { correlationId });
    return new Response(JSON.stringify({ success: true, service: "wa-webhook-core" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (targetService === "wa-webhook-core") {
    // Handle home menu in core
    const { handleHomeMenu } = await import("./handlers/home-menu.ts");
    return await handleHomeMenu(payload, headers, correlationId);
  }

  // Check circuit breaker before attempting request
  if (isServiceCircuitOpen(targetService)) {
    const breakerState = circuitBreakerManager.getBreaker(targetService).getState();
    logWarn("WA_CORE_CIRCUIT_OPEN", {
      service: targetService,
      breakerState,
    }, { correlationId });
    
    // Add to DLQ for later processing
    const message = getFirstMessage(payload);
    if (message) {
      await addToDeadLetterQueue(supabase, {
        message_id: message.id,
        from_number: message.from ?? "unknown",
        payload,
        error_message: `Circuit breaker open for ${targetService}`,
      }, correlationId);
    }
    
    return new Response(JSON.stringify({
      success: false,
      service: targetService,
      error: "Service temporarily unavailable (circuit open)",
      circuitOpen: true,
    }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = `${MICROSERVICES_BASE_URL}/${targetService}`;
  const forwardHeaders = new Headers(headers);
  forwardHeaders.set("Content-Type", "application/json");
  forwardHeaders.set("X-Routed-From", "wa-webhook-core");
  forwardHeaders.set("X-Routed-Service", targetService);
  forwardHeaders.set("X-Correlation-ID", correlationId);
  // Mark referral flows so downstream services don't misclassify normal text as a code.
  if (
    targetService === "wa-webhook-profile" &&
    decision.reason === "keyword" &&
    decision.routingText
  ) {
    const referralCode = extractReferralCode(decision.routingText);
    if (referralCode) {
      forwardHeaders.set("x-wa-referral-flow", "true");
    }
  }
  // Mark as internal forward to bypass signature verification in target service
  // (signature already verified in core, and body is re-stringified which changes it)
  forwardHeaders.set("x-wa-internal-forward", "true");
  // Add security token to prevent header spoofing
  const { generateInternalForwardToken } = await import("../_shared/security/internal-forward.ts");
  const forwardToken = generateInternalForwardToken();
  if (forwardToken) {
    forwardHeaders.set("x-wa-internal-forward-token", forwardToken);
  }
  // Add Authorization header for service-to-service calls
  const serviceRoleKey = getEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey) {
    forwardHeaders.set("Authorization", `Bearer ${serviceRoleKey}`);
  }

  try {
    // Use fetchWithRetry for automatic retry with exponential backoff
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(payload),
      timeoutMs: ROUTER_TIMEOUT_MS,
    }, correlationId);

    if (response.ok || response.status < 500) {
      // Success or client error - record success for circuit breaker
      recordServiceSuccess(targetService);
    } else {
      // Server error - record failure
      recordServiceFailure(targetService, response.status, correlationId);
    }

    if (response.status === 404) {
      logWarn(
        "WA_CORE_SERVICE_NOT_FOUND",
        { service: targetService, status: response.status },
        { correlationId },
      );
      const message = getFirstMessage(payload);
      if (message) {
        await addToDeadLetterQueue(
          supabase,
          {
            message_id: message.id,
            from_number: message.from ?? "unknown",
            payload,
            error_message: `Service ${targetService} not deployed (404)`,
          },
          correlationId,
        );
      }
      const { handleHomeMenu } = await import("./handlers/home-menu.ts");
      return await handleHomeMenu(payload, headers, correlationId);
    }

    logInfo("WA_CORE_ROUTED", { 
      service: targetService, 
      status: response.status,
    }, { correlationId });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.constructor.name : "UnknownError";
    
    // Record failure for circuit breaker
    recordServiceFailure(targetService, "error", correlationId);
    
    logError("WA_CORE_ROUTING_FAILURE", {
      service: targetService,
      error: errorMessage,
      errorName,
      errorStack: errorStack?.substring(0, 500), // Limit stack trace length
      url,
    }, { correlationId });

    // Add failed payload to DLQ
    const message = getFirstMessage(payload);
    if (message) {
      try {
        await addToDeadLetterQueue(supabase, {
          message_id: message.id,
          from_number: message.from,
          payload,
          error_message: errorMessage,
          error_stack: errorStack,
        }, correlationId);
      } catch (dlqError) {
        logError("WA_CORE_DLQ_STORE_FAILED", {
          service: targetService,
          dlqError: dlqError instanceof Error ? dlqError.message : String(dlqError),
        }, { correlationId });
      }
    }

    // Return 503 (Service Unavailable) instead of 500 to indicate temporary failure
    return new Response(JSON.stringify({
      success: false,
      service: targetService,
      error: "Service temporarily unavailable",
      retry_after: 60,
    }), {
      status: 503,
      headers: { 
        "Content-Type": "application/json",
        "Retry-After": "60",
      },
    });
  }
}

export async function summarizeServiceHealth(supabase: SupabaseClient): Promise<HealthStatus> {
  const start = performance.now();
  
  // 1. Check Database (Critical)
  let dbStatus = "unknown";
  try {
    const { error } = await supabase.from("profiles").select("user_id").limit(1);
    dbStatus = error ? "disconnected" : "connected";
  } catch {
    dbStatus = "error";
  }

  // 2. Check Microservices (Non-critical for core health)
  // We use allSettled so one slow service doesn't block the response
  const microservices = await getAllServicesHealth();

  // 3. Get circuit breaker states
  const circuitBreakers = getAllCircuitStates();

  const duration = performance.now() - start;

  return {
    status: dbStatus === "connected" ? "healthy" : "unhealthy",
    service: "wa-webhook-core",
    timestamp: new Date().toISOString(),
    checks: {
      database: dbStatus,
      latency: `${Math.round(duration)}ms`,
    },
    microservices,
    circuitBreakers,
    version: "2.2.0", // Version bump for resilience features
  };
}

async function getAllServicesHealth(): Promise<Record<string, boolean>> {
  // Check all services in parallel with a strict timeout per service
  const checks = ROUTED_SERVICES
    .filter(s => s !== "wa-webhook-core")
    .map(async (service) => {
      const isHealthy = await checkServiceHealth(service);
      return [service, isHealthy] as const;
    });

  const results = await Promise.all(checks);
  return Object.fromEntries(results);
}

async function checkServiceHealth(service: string): Promise<boolean> {
  try {
    // Short timeout for health checks (1.5s) to prevent cascading latency
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    
    const response = await fetch(`${MICROSERVICES_BASE_URL}/${service}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.status === "healthy";
  } catch {
    return false;
  }
}



// Utility functions moved to handlers/home-menu.ts

// Home menu handler extracted to handlers/home-menu.ts
export { handleHomeMenu } from "./handlers/home-menu.ts";

/**
 * Check if payload contains a call event
 */
export function isCallEvent(payload: WhatsAppWebhookPayload): boolean {
  return !!payload?.entry?.[0]?.changes?.[0]?.value?.call;
}

/**
 * Extract call event from payload
 */
export function getCallEvent(payload: WhatsAppWebhookPayload): WhatsAppCallEvent | null {
  return payload?.entry?.[0]?.changes?.[0]?.value?.call ?? null;
}
