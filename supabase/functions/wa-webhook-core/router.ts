
import { getRoutingText } from "../_shared/wa-webhook-shared/utils/messages.ts";
import type { WhatsAppWebhookPayload, RouterContext, WhatsAppMessage, WhatsAppCallEvent } from "../_shared/wa-webhook-shared/types.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { supabase } from "../_shared/wa-webhook-shared/config.ts";
import type { SupabaseClient } from "../_shared/wa-webhook-shared/deps.ts";
import {
  clearActiveService,
  getSessionByPhone,
  setActiveService,
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

import {
  buildMenuKeyMap,
  ROUTED_SERVICES,
} from "../_shared/route-config.ts";


// Build SERVICE_KEY_MAP from consolidated route config
const SERVICE_KEY_MAP = buildMenuKeyMap();

/**
 * Handle insurance agent request - dynamically fetch contacts from admin_contacts table
 * Queries admin_contacts table for category='insurance' and sends list of available contacts
 */
export async function handleInsuranceAgentRequest(phoneNumber: string): Promise<void> {
  try {
    // Query admin_contacts for active insurance contacts
    const { data: contacts, error } = await supabase
      .from("admin_contacts")
      .select("phone_number, name")
      .eq("category", "insurance")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      logError("INSURANCE_CONTACT_QUERY_ERROR", { error: error.message }, { correlationId: crypto.randomUUID() });
      await sendText(phoneNumber, "For insurance services, please contact our support team.");
      return;
    }

    if (!contacts || contacts.length === 0) {
      logWarn("NO_INSURANCE_CONTACT_FOUND", {}, { correlationId: crypto.randomUUID() });
      await sendText(phoneNumber, "Insurance services are currently unavailable. Please try again later.");
      return;
    }

    // Build engaging message with emojis and prefilled WhatsApp message
    let message = "🛡️ *Insurance Made Easy!*\n\n";
    message += "Get protected today! Our insurance team is ready to help you.\n\n";
    message += "📞 *Contact us now:*\n\n";
    
    const prefilledMessage = encodeURIComponent("Hi, I need motor insurance. Can you help me with a quote?");
    
    contacts.forEach((contact, index) => {
      const cleanNumber = contact.phone_number.replace(/^\+/, "");
      const whatsappLink = `https://wa.me/${cleanNumber}?text=${prefilledMessage}`;
      message += `${index + 1}. ${contact.name}\n`;
      message += `   💬 ${whatsappLink}\n\n`;
    });
    
    message += "✨ _Fast quotes • Easy claims • Peace of mind_";
    
    await sendText(phoneNumber, message.trim());
    
    logInfo("INSURANCE_CONTACTS_SENT", { 
      to: phoneNumber.substring(0, 6) + "***",
      contactCount: contacts.length 
    }, { correlationId: crypto.randomUUID() });
  } catch (err) {
    logError("INSURANCE_HANDLER_ERROR", { error: String(err) }, { correlationId: crypto.randomUUID() });
    // Send fallback message on any error
    await sendText(phoneNumber, "For insurance services, please contact our support team.");
  }
}

const MICROSERVICES_BASE_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const ROUTER_TIMEOUT_MS = Math.max(Number(Deno.env.get("WA_ROUTER_TIMEOUT_MS") ?? "4000") || 4000, 1000);

function getFirstMessage(payload: WhatsAppWebhookPayload): WhatsAppMessage | undefined {
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const messages = change?.value?.messages;
      if (Array.isArray(messages) && messages.length > 0) {
        return messages[0] as WhatsAppMessage;
      }
    }
  }
  return undefined;
}

export async function routeIncomingPayload(payload: WhatsAppWebhookPayload): Promise<RoutingDecision> {
  const routingMessage = getFirstMessage(payload);
  
  // Handle voice/audio messages -> Route to Voice Calls Handler
  if (routingMessage?.type === 'audio' || routingMessage?.type === 'voice') {
    return {
      service: "wa-webhook-voice-calls",
      reason: "keyword",
      routingText: "[VOICE_MESSAGE]",
    };
  }
  
  const routingText = routingMessage ? getRoutingText(routingMessage) : null;
  const phoneNumber = routingMessage?.from ?? null;

  if (routingText) {
    const normalized = routingText.trim().toLowerCase();
    const trimmedText = routingText.trim();
    const upperText = trimmedText.toUpperCase();
    
    // PRIORITY: Route referral codes (REF:CODE or standalone codes) to profile service
    // This handles new users clicking referral links with unique codes
    // Patterns (case-insensitive):
    //   - "REF:ABC12345" or "REF ABC12345" (with 4-12 alphanumeric characters after prefix)
    //   - Standalone codes: 6-12 alphanumeric characters (avoiding common words)
    const hasRefPrefix = /^REF[:\s]+[A-Z0-9]{4,12}$/i.test(trimmedText);
    const isStandaloneCode = /^[A-Z0-9]{6,12}$/.test(upperText) && 
                            !/^(HELLO|THANKS|CANCEL|SUBMIT|ACCEPT|REJECT|STATUS|URGENT|PLEASE|INSURANCE)$/.test(upperText);
    
    const isReferralCode = hasRefPrefix || isStandaloneCode;
    
    if (isReferralCode) {
      logInfo("WA_CORE_REFERRAL_CODE_DETECTED", { 
        code: trimmedText.substring(0, 8) + "***",
        from: phoneNumber?.substring(0, 6) ?? "unknown"
      }, { correlationId: crypto.randomUUID() });
      if (phoneNumber) {
        await setActiveService(supabase, phoneNumber, "wa-webhook-profile");
      }
      return {
        service: "wa-webhook-profile",
        reason: "keyword",
        routingText,
      };
    }
    
    // Always show home menu for generic greetings and menu keywords
    // This ensures users get the home menu regardless of other settings
    const isGreeting = /^(hi|hello|hey|hola|bonjour|menu|home|exit|start|help|\?)$/i.test(normalized);
    
    if (isGreeting || normalized === "menu" || normalized === "home" || normalized === "exit") {
      if (phoneNumber) {
        await clearActiveService(supabase, phoneNumber);
      }
      return {
        service: "wa-webhook-core",
        reason: "home_menu",
        routingText,
      };
    }
    
    // Note: Insurance is handled in handleHomeMenu when selected from menu
    // Only handle direct text "insurance_agent" here
    if (normalized === "insurance_agent") {
      if (phoneNumber) {
        await handleInsuranceAgentRequest(phoneNumber);
      }
      return {
        service: "wa-webhook-core",
        reason: "keyword",
        routingText,
      };
    }
    
    if (SERVICE_KEY_MAP[normalized]) {
      if (phoneNumber) {
        await setActiveService(supabase, phoneNumber, SERVICE_KEY_MAP[normalized]);
      }
      return {
        service: SERVICE_KEY_MAP[normalized],
        reason: "keyword",
        routingText,
      };
    }
  }

  if (phoneNumber) {
    const session = await getSessionByPhone(supabase, phoneNumber);
    if (session?.active_service && ROUTED_SERVICES.includes(session.active_service)) {
      return {
        service: session.active_service,
        reason: "state",
        routingText,
      };
    }
  }

  // Default: show home menu for any unrecognized text
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
    const correlationId = headers?.get("X-Correlation-ID") ?? crypto.randomUUID();
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
        from_number: message.from,
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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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
            from_number: message.from,
            payload,
            error_message: `Service ${targetService} not deployed (404)`,
          },
          correlationId,
        );
      }
      const { handleHomeMenu } = await import("./handlers/home-menu.ts");
      const correlationId = headers?.get("X-Correlation-ID") ?? crypto.randomUUID();
      return await handleHomeMenu(payload, headers, correlationId);
    }

    logInfo("WA_CORE_ROUTED", { 
      service: targetService, 
      status: response.status,
    }, { correlationId });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Record failure for circuit breaker
    recordServiceFailure(targetService, "error", correlationId);
    
    logError("WA_CORE_ROUTING_FAILURE", {
      service: targetService,
      error: errorMessage,
    }, { correlationId });

    // Add failed payload to DLQ
    const message = getFirstMessage(payload);
    if (message) {
      await addToDeadLetterQueue(supabase, {
        message_id: message.id,
        from_number: message.from,
        payload,
        error_message: errorMessage,
        error_stack: error instanceof Error ? error.stack : undefined,
      }, correlationId);
    }

    return new Response(JSON.stringify({
      success: false,
      service: targetService,
      error: "Service temporarily unavailable",
    }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
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
