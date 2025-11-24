import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeMessage } from "./routing_logic.ts";
import { getRoutingText } from "../_shared/wa-webhook-shared/utils/messages.ts";
import type { WhatsAppMessage, WhatsAppWebhookPayload } from "../_shared/wa-webhook-shared/types.ts";

type RoutingDecision = {
  service: string;
  reason: "keyword" | "state" | "fallback";
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
  const service = routingText ? await routeMessage(routingText, chatStateKey) : "wa-webhook-core";

  return {
    service,
    reason: routingText ? "keyword" : chatStateKey ? "state" : "fallback",
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
    return new Response(JSON.stringify({ success: true, service: decision.service }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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
