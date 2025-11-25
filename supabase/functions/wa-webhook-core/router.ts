
import { getRoutingText } from "../_shared/wa-webhook-shared/utils/messages.ts";
import type { WhatsAppWebhookPayload, RouterContext, WhatsAppMessage } from "../_shared/wa-webhook-shared/types.ts";
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
  const routingText = routingMessage ? getRoutingText(routingMessage) : null;
  const phoneNumber = routingMessage?.from ?? null;

  if (routingText) {
    const normalized = routingText.trim().toLowerCase();
    if (normalized === "menu" || normalized === "home" || normalized === "exit") {
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
  
  if (!ROUTED_SERVICES.includes(decision.service)) {
    console.warn(`Unknown service '${decision.service}', handling inside core.`);
    return new Response(JSON.stringify({ success: true, service: "wa-webhook-core" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (decision.service === "wa-webhook-core") {
    // Handle home menu in core
    return await handleHomeMenu(payload, headers);
  }

  // Check circuit breaker before attempting request
  if (isServiceCircuitOpen(decision.service)) {
    const breakerState = circuitBreakerManager.getBreaker(decision.service).getState();
    console.warn(JSON.stringify({
      event: "WA_CORE_CIRCUIT_OPEN",
      service: decision.service,
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
        error_message: `Circuit breaker open for ${decision.service}`,
      }, correlationId);
    }
    
    return new Response(JSON.stringify({
      success: false,
      service: decision.service,
      error: "Service temporarily unavailable (circuit open)",
      circuitOpen: true,
    }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = `${MICROSERVICES_BASE_URL}/${decision.service}`;
  const forwardHeaders = new Headers(headers);
  forwardHeaders.set("Content-Type", "application/json");
  forwardHeaders.set("X-Routed-From", "wa-webhook-core");
  forwardHeaders.set("X-Routed-Service", decision.service);
  forwardHeaders.set("X-Correlation-ID", correlationId);

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
      recordServiceSuccess(decision.service);
    } else {
      // Server error - record failure
      recordServiceFailure(decision.service, response.status, correlationId);
    }

    console.log(JSON.stringify({
      event: "WA_CORE_ROUTED",
      service: decision.service,
      status: response.status,
      correlationId,
    }));

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Record failure for circuit breaker
    recordServiceFailure(decision.service, "error", correlationId);
    
    console.error(JSON.stringify({
      event: "WA_CORE_ROUTING_FAILURE",
      service: decision.service,
      error: errorMessage,
      correlationId,
    }));

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
      service: decision.service,
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
    console.error("Failed to fetch home menu items:", error);
    return [];
  }

  return data as WhatsAppHomeMenuItem[];
}

async function handleHomeMenu(payload: WhatsAppWebhookPayload, headers?: Headers): Promise<Response> {
  console.log(JSON.stringify({ event: "HANDLE_HOME_MENU_START" }));
  
  const message = getFirstMessage(payload);
  if (!message) {
    console.log(JSON.stringify({ event: "NO_MESSAGE_IN_PAYLOAD" }));
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
  
  console.log(JSON.stringify({ 
    event: "MESSAGE_RECEIVED", 
    from: phoneNumber, 
    text: selection ?? null,
  }));
  
  if (selection === "menu" || selection === "home") {
    console.log(JSON.stringify({ event: "MENU_REQUESTED", from: phoneNumber }));
    if (phoneNumber) await clearActiveService(supabase, phoneNumber);
  } else if (selection) {
    const isInteractive = Boolean(interactiveId);
    const targetService = SERVICE_KEY_MAP[selection] ?? (isInteractive ? FALLBACK_SERVICE : null);
    if (targetService) {
      console.log(JSON.stringify({ event: "ROUTING_TO_SERVICE", service: targetService, selection }));
      if (phoneNumber) await setActiveService(supabase, phoneNumber, targetService);
      const url = `${MICROSERVICES_BASE_URL}/${targetService}`;
      const forwardHeaders = new Headers(headers);
      forwardHeaders.set("Content-Type", "application/json");
      forwardHeaders.set("X-Routed-From", "wa-webhook-core");
      forwardHeaders.set("X-Menu-Selection", selection);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: forwardHeaders,
          body: JSON.stringify(payload),
        });
        console.log(JSON.stringify({ event: "FORWARDED", service: targetService, status: response.status }));
        return response;
      } catch (error) {
        console.error(JSON.stringify({ event: "FORWARD_FAILED", service: targetService, error: String(error) }));
      }
    } else if (!isInteractive) {
      console.log(JSON.stringify({ event: "TEXT_NOT_RECOGNIZED", input: selection }));
      if (phoneNumber) await clearActiveService(supabase, phoneNumber);
    }
  } else if (phoneNumber) {
    await clearActiveService(supabase, phoneNumber);
  }

  // Show home menu - interactive list message
  console.log(JSON.stringify({ event: "SHOWING_HOME_MENU", to: phoneNumber }));

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
      console.warn("No active menu items found in DB, using fallback");
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
    console.error(JSON.stringify({ event: "SEND_MESSAGE_FAILED", error: String(error) }));
    return new Response(JSON.stringify({ error: "Failed to send message" }), { status: 500 });
  }
}
