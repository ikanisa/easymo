
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

const FALLBACK_SERVICE = "wa-webhook";

const SERVICE_KEY_MAP: Record<string, string> = {
  // Mobility / rides
  "rides": "wa-webhook-mobility",
  "mobility": "wa-webhook-mobility",
  "rides_agent": "wa-webhook-mobility",
  "nearby_drivers": "wa-webhook-mobility",
  "nearby_passengers": "wa-webhook-mobility",
  "schedule_trip": "wa-webhook-mobility",

  // Insurance
  "insurance": "wa-webhook-insurance",
  "insurance_agent": "wa-webhook-insurance",
  "motor_insurance": "wa-webhook-insurance",
  "insurance_submit": "wa-webhook-insurance",
  "insurance_help": "wa-webhook-insurance",
  "motor_insurance_upload": "wa-webhook-insurance",

  // Jobs
  "jobs": "wa-webhook-jobs",
  "jobs_agent": "wa-webhook-jobs",

  // Property
  "property": "wa-webhook-property",
  "property_rentals": "wa-webhook-property",
  "property rentals": "wa-webhook-property",
  "real_estate_agent": "wa-webhook-property",

  // Marketplace / commerce
  "marketplace": "wa-webhook-marketplace",
  "shops_services": "wa-webhook-marketplace",
  "buy_and_sell": "wa-webhook-marketplace",
  "buy and sell": "wa-webhook-marketplace",
  "business_broker_agent": "wa-webhook-marketplace",
  "general_broker": "wa-webhook-marketplace",

  // Wallet / profile
  "wallet": "wa-webhook-profile",
  "token_transfer": "wa-webhook-profile",
  "momo_qr": "wa-webhook-profile",
  "momo qr": "wa-webhook-profile",
  "momoqr": "wa-webhook-profile",
  "profile": "wa-webhook-profile",
  "profile_assets": "wa-webhook-profile",
  "my_business": "wa-webhook-profile",
  "my_businesses": "wa-webhook-profile",
  "my_jobs": "wa-webhook-profile",
  "my_properties": "wa-webhook-profile",
  "saved_locations": "wa-webhook-profile",

  // AI / support agents
  "ai_agents": "wa-webhook-ai-agents",
  "farmer_agent": "wa-webhook-ai-agents",
  "sales_agent": "wa-webhook-ai-agents",
  "waiter_agent": "wa-webhook-ai-agents",
  "waiter": "wa-webhook-ai-agents",
  "support": "wa-webhook-ai-agents",
  "customer_support": "wa-webhook-ai-agents",
  "farmers": "wa-webhook-ai-agents",

  // Legacy numeric mapping (keep for backwards compatibility)
  "1": "wa-webhook-mobility",
  "2": "wa-webhook-insurance",
  "3": "wa-webhook-jobs",
  "4": "wa-webhook-property",
  "5": "wa-webhook-wallet",
  "6": "wa-webhook-marketplace",
  "7": "wa-webhook-ai-agents",
};

const MICROSERVICES_BASE_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const ROUTER_TIMEOUT_MS = Math.max(Number(Deno.env.get("WA_ROUTER_TIMEOUT_MS") ?? "4000") || 4000, 1000);

const ROUTED_SERVICES = [
  "wa-webhook-jobs",
  "wa-webhook-marketplace",
  "wa-webhook-ai-agents",
  "wa-webhook-property",
  "wa-webhook-mobility",
  "wa-webhook-wallet",
  "wa-webhook-profile",
  "wa-webhook-insurance",
  FALLBACK_SERVICE,
  "wa-webhook-core",
];

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

  const url = `${MICROSERVICES_BASE_URL}/${decision.service}`;
  const forwardHeaders = new Headers(headers);
  forwardHeaders.set("Content-Type", "application/json");
  forwardHeaders.set("X-Routed-From", "wa-webhook-core");
  forwardHeaders.set("X-Routed-Service", decision.service);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    console.log(JSON.stringify({
      event: "WA_CORE_ROUTED",
      service: decision.service,
      status: response.status,
    }));

    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "WA_CORE_ROUTING_FAILURE",
      service: decision.service,
      error: error instanceof Error ? error.message : String(error),
    }));

    return new Response(JSON.stringify({
      success: false,
      service: decision.service,
      error: "Service temporarily unavailable",
    }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    clearTimeout(timeout);
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
    version: "2.1.0",
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
