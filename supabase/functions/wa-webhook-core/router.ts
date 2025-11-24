import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeMessage } from "./routing_logic.ts";
import { getRoutingText } from "../_shared/wa-webhook-shared/utils/messages.ts";
import type { WhatsAppMessage, WhatsAppWebhookPayload } from "../_shared/wa-webhook-shared/types.ts";

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

const MICROSERVICES_BASE_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const ROUTER_TIMEOUT_MS = Math.max(Number(Deno.env.get("WA_ROUTER_TIMEOUT_MS") ?? "4000") || 4000, 1000);

const ROUTED_SERVICES = [
  "wa-webhook-jobs",
  "wa-webhook-marketplace",
  "wa-webhook-ai-agents",
  "wa-webhook-property",
  "wa-webhook-mobility",
  "wa-webhook-wallet",
  "wa-webhook-insurance",
  "wa-webhook-core",
];

export async function routeIncomingPayload(payload: WhatsAppWebhookPayload): Promise<RoutingDecision> {
  const routingMessage = getFirstMessage(payload);
  const routingText = routingMessage ? getRoutingText(routingMessage) : null;
  const chatStateKey = extractChatState(payload);
  
  // All messages handled by wa-webhook-core (shows home menu)
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

function extractChatState(payload: WhatsAppWebhookPayload): string | undefined {
  const states = payload?.entry?.flatMap((entry) => entry?.changes ?? [])
    .map((change) => change?.value?.metadata?.routing_state)
    .filter((state): state is string => typeof state === "string" && state.length > 0);
  return states?.[0];
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
  
  // Check if message is a menu selection (number 1-9)
  const menuSelection = text?.trim();
  if (menuSelection && /^[1-9]$/.test(menuSelection)) {
    console.log(JSON.stringify({ event: "MENU_SELECTION", selection: menuSelection }));
    
    const serviceMap: Record<string, string> = {
      "1": "wa-webhook-mobility",
      "2": "wa-webhook-insurance",
      "3": "wa-webhook-jobs",
      "4": "wa-webhook-property",
      "5": "wa-webhook-wallet",
      "6": "wa-webhook-marketplace",
      "7": "wa-webhook-ai-agents",
    };

    const targetService = serviceMap[menuSelection];
    if (targetService) {
      console.log(JSON.stringify({ event: "ROUTING_TO_SERVICE", service: targetService }));
      
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
  }

  // Show home menu - direct WhatsApp API call
  console.log(JSON.stringify({ event: "SHOWING_HOME_MENU", to: phoneNumber }));
  
  const menuMessage = `Welcome to EasyMO! 🎯

Choose a service:

1️⃣ Rides & Transport
2️⃣ Insurance
3️⃣ Jobs & Careers
4️⃣ Property Rentals
5️⃣ Wallet & Profile
6️⃣ Marketplace
7️⃣ AI Support

Reply with a number (1-7) to continue.`;

  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  if (!accessToken || !phoneNumberId) {
    console.error(JSON.stringify({ event: "MISSING_CREDENTIALS" }));
    return new Response(JSON.stringify({ error: "Configuration error" }), { status: 500 });
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneNumber,
          type: "text",
          text: { body: menuMessage },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(JSON.stringify({ event: "WHATSAPP_API_ERROR", status: response.status, error }));
      return new Response(JSON.stringify({ error: "Failed to send message" }), { status: 500 });
    }

    console.log(JSON.stringify({ event: "MENU_SENT_SUCCESS", to: phoneNumber }));
    return new Response(JSON.stringify({ success: true, menu_shown: true }), { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({ event: "SEND_MESSAGE_FAILED", error: String(error) }));
    return new Response(JSON.stringify({ error: "Failed to send message" }), { status: 500 });
  }
}
