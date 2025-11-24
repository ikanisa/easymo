
import { getRoutingText } from "../_shared/wa-webhook-shared/utils/messages.ts";
import type { WhatsAppWebhookPayload, RouterContext, WhatsAppMessage } from "../_shared/wa-webhook-shared/types.ts";
import { sendListMessage } from "../_shared/wa-webhook-shared/utils/reply.ts";
import { supabase } from "../_shared/wa-webhook-shared/config.ts";
import type { SupabaseClient } from "../_shared/wa-webhook-shared/deps.ts";

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

const SERVICE_KEY_MAP: Record<string, string> = {
  "rides": "wa-webhook-mobility",
  "mobility": "wa-webhook-mobility",
  "insurance": "wa-webhook-insurance",
  "jobs": "wa-webhook-jobs",
  "property": "wa-webhook-property",
  "wallet": "wa-webhook-profile",  // Updated to profile
  "marketplace": "wa-webhook-marketplace",
  "ai_agents": "wa-webhook-ai-agents",
  // DB Item Mappings
  "rides_agent": "wa-webhook-mobility",
  "jobs_agent": "wa-webhook-jobs",
  "business_broker_agent": "wa-webhook-marketplace",
  "real_estate_agent": "wa-webhook-property",
  "farmer_agent": "wa-webhook-ai-agents",
  "insurance_agent": "wa-webhook-insurance",
  "sales_agent": "wa-webhook-ai-agents",
  "waiter_agent": "wa-webhook-ai-agents",
  "profile": "wa-webhook-profile",  // Updated to profile
  // Profile-related features
  "my_business": "wa-webhook-profile",
  "my_businesses": "wa-webhook-profile",
  "my_jobs": "wa-webhook-profile",
  "my_properties": "wa-webhook-profile",
  "saved_locations": "wa-webhook-profile",
  // Legacy numeric mapping
  "1": "wa-webhook-mobility",
  "2": "wa-webhook-insurance",
  "3": "wa-webhook-jobs",
  "4": "wa-webhook-property",
  "5": "wa-webhook-profile",  // Updated to profile
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
  "wa-webhook-profile",  // Updated from wa-webhook-wallet
  "wa-webhook-insurance",
  "wa-webhook-core",
];

export async function routeIncomingPayload(payload: WhatsAppWebhookPayload): Promise<RoutingDecision> {
  const routingMessage = getFirstMessage(payload);
  const routingText = routingMessage ? getRoutingText(routingMessage) : null;
  
  // Check if text matches a service key
  if (routingText) {
    const normalized = routingText.trim().toLowerCase();
    if (SERVICE_KEY_MAP[normalized]) {
      return {
        service: SERVICE_KEY_MAP[normalized],
        reason: "keyword",
        routingText,
      };
    }
  }

  // All other messages handled by wa-webhook-core (shows home menu)
  const service = "wa-webhook-core";

  return {
    service,
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
  try {
    const { error } = await supabase.from("profiles").select("user_id").limit(1);
    const microservices = await getAllServicesHealth();
    return {
      status: error ? "unhealthy" : "healthy",
      service: "wa-webhook-core",
      timestamp: new Date().toISOString(),
      checks: {
        database: error ? "disconnected" : "connected",
        table: "profiles",
      },
      microservices,
      version: "2.0.0",
      ...(error && { error: error.message }),
    };
  } catch (err) {
    return {
      status: "unhealthy",
      service: "wa-webhook-core",
      timestamp: new Date().toISOString(),
      checks: { database: "error" },
      microservices: {},
      version: "2.0.0",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function getAllServicesHealth(): Promise<Record<string, boolean>> {
  const entries = await Promise.all(
    ROUTED_SERVICES.map(async (service) => [service, await checkServiceHealth(service)] as const),
  );
  return Object.fromEntries(entries);
}

async function checkServiceHealth(service: string): Promise<boolean> {
  try {
    const response = await fetch(`${MICROSERVICES_BASE_URL}/${service}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(ROUTER_TIMEOUT_MS),
    });
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
  
  console.log(JSON.stringify({ 
    event: "MESSAGE_RECEIVED", 
    from: phoneNumber, 
    text: text?.substring(0, 50) 
  }));
  
  // Check if message is a menu selection (mapped key)
  const menuSelection = text?.trim().toLowerCase();
  if (menuSelection && SERVICE_KEY_MAP[menuSelection]) {
    const targetService = SERVICE_KEY_MAP[menuSelection];
    console.log(JSON.stringify({ event: "ROUTING_TO_SERVICE", service: targetService, selection: menuSelection }));
    
    const url = `${MICROSERVICES_BASE_URL}/${targetService}`;
    const forwardHeaders = new Headers(headers);
    forwardHeaders.set("Content-Type", "application/json");
    forwardHeaders.set("X-Routed-From", "wa-webhook-core");
    forwardHeaders.set("X-Menu-Selection", menuSelection);

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
