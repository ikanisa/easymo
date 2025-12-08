
import { getRoutingText } from "../_shared/wa-webhook-shared/utils/messages.ts";
import type { WhatsAppWebhookPayload, RouterContext, WhatsAppMessage, WhatsAppCallEvent } from "../_shared/wa-webhook-shared/types.ts";
import { sendListMessage } from "../_shared/wa-webhook-shared/utils/reply.ts";
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
  checkRateLimit,
  fetchWithRetry,
  getAllCircuitStates,
} from "../_shared/service-resilience.ts";
import { addToDeadLetterQueue } from "../_shared/dead-letter-queue.ts";
import { circuitBreakerManager } from "../_shared/circuit-breaker.ts";
import { logError, logWarn, logInfo } from "../_shared/correlation-logging.ts";
import { isFeatureEnabled } from "../_shared/feature-flags.ts";
import {
  resolveServiceWithMigration,
  isServiceDeprecated,
  DEPRECATED_SERVICES,
  UNIFIED_SERVICE,
} from "../_shared/route-config.ts";

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

type WhatsAppHomeMenuItem = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  active_countries: string[];
};

import {
  buildMenuKeyMap,
  ROUTED_SERVICES,
  getServiceFromState as getServiceFromStateConfig,
} from "../_shared/route-config.ts";

const FALLBACK_SERVICE = "wa-webhook";

// Build SERVICE_KEY_MAP from consolidated route config
const SERVICE_KEY_MAP = buildMenuKeyMap();
// Retry configuration
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 200;
const RETRIABLE_STATUS_CODES = [408, 429, 503, 504];

/**
 * Sleep for a given duration with optional jitter
 */
function sleep(ms: number, jitter = true): Promise<void> {
  const delay = jitter ? ms * (0.8 + Math.random() * 0.4) : ms;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Check if an error or status code is retriable
 */
function isRetriable(error: unknown, statusCode?: number): boolean {
  // Network errors are retriable
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("network") || message.includes("timeout") || message.includes("abort")) {
      return true;
    }
  }
  
  // Specific status codes are retriable
  if (statusCode && RETRIABLE_STATUS_CODES.includes(statusCode)) {
    return true;
  }
  
  return false;
}

const MICROSERVICES_BASE_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const ROUTER_TIMEOUT_MS = Math.max(Number(Deno.env.get("WA_ROUTER_TIMEOUT_MS") ?? "4000") || 4000, 1000);

export async function routeIncomingPayload(payload: WhatsAppWebhookPayload): Promise<RoutingDecision> {
  const routingMessage = getFirstMessage(payload);
  
  // Handle voice/audio messages -> Route to Call Center AGI
  if (routingMessage?.type === 'audio' || routingMessage?.type === 'voice') {
    return {
      service: "wa-agent-call-center",
      reason: "keyword",
      routingText: "[VOICE_MESSAGE]",
    };
  }
  
  const routingText = routingMessage ? getRoutingText(routingMessage) : null;
  const phoneNumber = routingMessage?.from ?? null;
  
  // Log the extracted routing info for debugging
  logInfo("ROUTING_EXTRACTION", {
    messageType: routingMessage?.type,
    routingText,
    phoneNumber: phoneNumber ? (phoneNumber.length >= 4 ? phoneNumber.slice(-4) : "SHORT") : null,
  }, { correlationId: crypto.randomUUID() });

  if (routingText) {
    const normalized = routingText.trim().toLowerCase();
    
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

  // Check if unified agent system is enabled (but only for non-greeting text)
  const unifiedSystemEnabled = await (async () => {
    try {
      const { isFeatureEnabled } = await import("../_shared/feature-flags.ts");
      return isFeatureEnabled("agent.unified_system");
    } catch {
      return false; // Graceful degradation if feature flags unavailable
    }
  })();

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

  // If unified system enabled, route to AI agents (but greetings were already handled above)
  if (unifiedSystemEnabled) {
    console.log(JSON.stringify({
      event: "ROUTE_TO_UNIFIED_AGENT_SYSTEM",
      message: routingText?.substring(0, 50) ?? null,
      target: "wa-webhook-ai-agents",
    }));
    return {
      service: "wa-webhook-ai-agents",
      reason: "keyword",
      routingText,
    };
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
  
  // Check if unified webhook migration is enabled
  const useUnifiedWebhook = isFeatureEnabled("agent.unified_webhook");
  
  // Resolve the final service, potentially redirecting deprecated services to unified
  let targetService = decision.service;
  const originalService = decision.service;
  
  if (useUnifiedWebhook && isServiceDeprecated(decision.service)) {
    targetService = resolveServiceWithMigration(decision.service, true);
    
    // Log the migration redirect for monitoring
    logInfo("WA_CORE_MIGRATION_REDIRECT", {
      originalService,
      targetService,
      reason: "deprecated_service_redirect",
    }, { correlationId });
  }
  
  if (!ROUTED_SERVICES.includes(targetService)) {
    console.warn(`Unknown service '${targetService}', handling inside core.`);
    return new Response(JSON.stringify({ success: true, service: "wa-webhook-core" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (targetService === "wa-webhook-core") {
    // Handle home menu in core
    return await handleHomeMenu(payload, headers);
  }

  // Check circuit breaker before attempting request
  if (isServiceCircuitOpen(targetService)) {
    const breakerState = circuitBreakerManager.getBreaker(targetService).getState();
    console.warn(JSON.stringify({
      event: "WA_CORE_CIRCUIT_OPEN",
      service: targetService,
      originalService: originalService !== targetService ? originalService : undefined,
      breakerState,
      correlationId,
    }));
    
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
  forwardHeaders.set("X-Original-Service", originalService); // Track original for debugging
  forwardHeaders.set("X-Correlation-ID", correlationId);
  
  // Include service role key for internal service-to-service auth
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
        { service: targetService, originalService, status: response.status },
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
      return await handleHomeMenu(payload, headers);
    }

    logInfo("WA_CORE_ROUTED", { 
      service: targetService, 
      originalService: originalService !== targetService ? originalService : undefined,
      status: response.status,
    }, { correlationId });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Record failure for circuit breaker
    recordServiceFailure(targetService, "error", correlationId);
    
    logError("WA_CORE_ROUTING_FAILURE", {
      service: targetService,
      originalService: originalService !== targetService ? originalService : undefined,
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
      originalService: originalService !== targetService ? originalService : undefined,
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
    .filter(s => s !== "wa-webhook-core" && s !== FALLBACK_SERVICE)
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

function getMenuSelectionId(message?: WhatsAppMessage): string | null {
  if (!message || message.type !== "interactive") return null;
  const interactive = (message as { interactive?: Record<string, unknown> }).interactive;
  if (!interactive) return null;
  const listReply = interactive.list_reply as { id?: string } | undefined;
  if (listReply?.id && listReply.id.trim().length) {
    return listReply.id.trim().toLowerCase();
  }
  const buttonReply = interactive.button_reply as { id?: string } | undefined;
  if (buttonReply?.id && buttonReply.id.trim().length) {
    return buttonReply.id.trim().toLowerCase();
  }
  return null;
}

async function fetchHomeMenuItems(): Promise<WhatsAppHomeMenuItem[]> {
  const { data, error } = await supabase
    .from("whatsapp_home_menu_items")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    // Use structured logging instead of raw console.error
    logError("FETCH_HOME_MENU_FAILED", { error: error.message }, { correlationId: crypto.randomUUID() });
    return [];
  }

  return data as WhatsAppHomeMenuItem[];
}

async function handleHomeMenu(payload: WhatsAppWebhookPayload, headers?: Headers): Promise<Response> {
  const correlationId = crypto.randomUUID();
  logInfo("HANDLE_HOME_MENU_START", {}, { correlationId });
  
  const message = getFirstMessage(payload);
  if (!message) {
    logInfo("NO_MESSAGE_IN_PAYLOAD", {}, { correlationId });
    return new Response(JSON.stringify({ success: true, message: "No message to process" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const phoneNumber = message.from;
  const text = getRoutingText(message);
  const interactiveId = getMenuSelectionId(message);
  const normalizedText = text?.trim().toLowerCase() ?? null;
  const selection = interactiveId ?? normalizedText;
  
  logInfo("MESSAGE_RECEIVED", { 
    from: phoneNumber, 
    messageType: message.type,
    text: text,
    interactiveId: interactiveId,
    normalizedText: normalizedText,
    selection: selection 
  }, { correlationId });
  
  if (selection === "menu" || selection === "home") {
    logInfo("MENU_REQUESTED", { from: phoneNumber }, { correlationId });
    if (phoneNumber) await clearActiveService(supabase, phoneNumber);
  } else if (selection) {
    const isInteractive = Boolean(interactiveId);
    const targetService = SERVICE_KEY_MAP[selection] ?? (isInteractive ? FALLBACK_SERVICE : null);
    const foundInMap = !!SERVICE_KEY_MAP[selection];
    
    const allKeys = Object.keys(SERVICE_KEY_MAP);
    logInfo("ROUTING_DECISION", { 
      selection, 
      isInteractive, 
      targetService,
      foundInMap,
      // Only log keys if not found to help debug
      availableKeys: foundInMap ? undefined : allKeys.slice(0, 10).join(", ") + (allKeys.length > 10 ? "..." : "")
    }, { correlationId });
    
    if (targetService) {
      logInfo("ROUTING_TO_SERVICE", { service: targetService, selection }, { correlationId });
      if (phoneNumber) await setActiveService(supabase, phoneNumber, targetService);
      const url = `${MICROSERVICES_BASE_URL}/${targetService}`;
      const forwardHeaders = new Headers(headers);
      forwardHeaders.set("Content-Type", "application/json");
      forwardHeaders.set("X-Routed-From", "wa-webhook-core");
      forwardHeaders.set("X-Menu-Selection", selection);
      
      // Include service role key for internal service-to-service auth
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (serviceRoleKey) {
        forwardHeaders.set("Authorization", `Bearer ${serviceRoleKey}`);
      } else {
        logWarn("MISSING_SERVICE_ROLE_KEY", { 
          targetService,
          message: "Service role key not found - authorization may fail"
        }, { correlationId });
      }

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: forwardHeaders,
          body: JSON.stringify(payload),
        });
        if (response.status === 404) {
          logWarn(
            "WA_CORE_MENU_SERVICE_NOT_FOUND",
            { service: targetService, status: response.status },
            { correlationId },
          );
          console.warn(JSON.stringify({
            event: "WA_CORE_MENU_FALLBACK",
            reason: "service_missing",
            service: targetService,
          }));
        } else {
          logInfo("FORWARDED", { service: targetService, status: response.status }, { correlationId });
          return response;
        }
      } catch (error) {
        logError("FORWARD_FAILED", { service: targetService, error: String(error) }, { correlationId });
      }
    } else if (!isInteractive) {
      logInfo("TEXT_NOT_RECOGNIZED", { input: selection }, { correlationId });
      if (phoneNumber) await clearActiveService(supabase, phoneNumber);
    } else {
      logInfo("INTERACTIVE_NOT_MAPPED", { input: selection, willUseFallback: false }, { correlationId });
    }
  } else if (phoneNumber) {
    await clearActiveService(supabase, phoneNumber);
  }

  // Show home menu - interactive list message
  logInfo("SHOWING_HOME_MENU", { to: phoneNumber }, { correlationId });

  const ctx: RouterContext = {
    supabase,
    from: phoneNumber,
    locale: "en",
  };

  try {
    // Fetch dynamic menu items
    const menuItems = await fetchHomeMenuItems();
    
    const rows = menuItems.map(item => ({
      id: item.key, // Use key as the ID for routing
      title: item.name,
      description: item.description || undefined,
    }));

    // Fallback if no items found (shouldn't happen if DB is populated)
    if (rows.length === 0) {
      logWarn("NO_ACTIVE_MENU_ITEMS", { message: "No active menu items found in DB, using fallback" }, { correlationId });
      rows.push(
        { id: "rides", title: "Rides & Transport", description: "Request a ride or delivery" },
        { id: "insurance", title: "Insurance", description: "Buy or manage insurance" },
        { id: "jobs", title: "Jobs & Careers", description: "Find jobs or hire" },
        { id: "property", title: "Property Rentals", description: "Rent houses or apartments" },
        { id: "wallet", title: "Wallet & Profile", description: "Manage funds and settings" },
        { id: "marketplace", title: "Marketplace", description: "Buy and sell items" },
        { id: "ai_agents", title: "AI Support", description: "Chat with our AI assistant" }
      );
    }

    logInfo("HOME_MENU_ITEMS_LOADED", { 
      count: rows.length, 
      menuKeys: rows.map(r => r.id).join(", ")
    }, { correlationId });

    await sendListMessage(ctx, {
      title: "easyMO Services",
      body: "✨ Hello 👋 Do more with easyMO, Rides, Shops, MOMO QR codes ..and more.",
      buttonText: "View Services",
      sectionTitle: "Services",
      rows: rows,
    });

    console.log(JSON.stringify({ event: "MENU_SENT_SUCCESS", to: phoneNumber, itemCount: rows.length }));
    return new Response(JSON.stringify({ success: true, menu_shown: true }), { status: 200 });
  } catch (error) {
    logError("SEND_MESSAGE_FAILED", { error: String(error) }, { correlationId });
    return new Response(JSON.stringify({ error: "Failed to send message" }), { status: 500 });
  }
}

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
