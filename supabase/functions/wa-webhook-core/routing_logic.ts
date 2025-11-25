// Traffic Router for wa-webhook microservices
// Routes incoming WhatsApp messages to appropriate microservice based on domain

import { SUPABASE_SERVICE_ROLE_KEY } from "../_shared/wa-webhook-shared/config.ts";
import { fetchWithTimeout } from "../_shared/wa-webhook-shared/utils/http.ts";
import { isFeatureEnabled } from "../_shared/feature-flags.ts";
import {
  ROUTE_CONFIGS,
  ROUTED_SERVICES,
  getServiceFromState as getServiceFromStateConfig,
  matchKeywordsToService,
} from "../_shared/route-config.ts";

const MICROSERVICES_BASE_URL = Deno.env.get("SUPABASE_URL") + "/functions/v1";
const ROUTER_TIMEOUT_MS = Math.max(
  Number(Deno.env.get("WA_ROUTER_TIMEOUT_MS") ?? "4000") || 4000,
  1000,
);
const ROUTER_RETRY_ATTEMPTS = Math.max(
  Number(Deno.env.get("WA_ROUTER_RETRIES") ?? "0") || 0,
  0,
);
const ROUTER_RETRY_DELAY_MS = Math.max(
  Number(Deno.env.get("WA_ROUTER_RETRY_DELAY_MS") ?? "200") || 200,
  0,
);

// Note: Route configuration is now in _shared/route-config.ts
// Using the consolidated ROUTE_CONFIGS from there

/**
 * Route message to appropriate microservice
 */
export async function routeMessage(
  messageText: string,
  chatState?: string
): Promise<string> {
  // If unified agent system is enabled, route everything to ai-agents
  const unifiedSystemEnabled = isFeatureEnabled("agent.unified_system");
  console.log(JSON.stringify({
    event: "ROUTE_CHECK_UNIFIED_SYSTEM",
    message: messageText.substring(0, 50),
    unified_system_enabled: unifiedSystemEnabled,
  }));
  
  if (unifiedSystemEnabled) {
    console.log(JSON.stringify({
      event: "ROUTE_TO_UNIFIED_AGENT_SYSTEM",
      message: messageText.substring(0, 50),
      target: "wa-webhook-ai-agents",
    }));
    return "wa-webhook-ai-agents";
  }

  // 1. Check chat state first (user is in a flow)
  if (chatState) {
    const stateService = getServiceFromStateConfig(chatState);
    if (stateService) {
      return stateService;
    }
  }

  // 2. Match keywords using consolidated config
  const matchedService = matchKeywordsToService(messageText);
  if (matchedService) {
    return matchedService;
  }

  // 3. Default to core service (handles general queries)
  return "wa-webhook-core";
}

// Note: getServiceFromState is now imported from route-config.ts as getServiceFromStateConfig

/**
 * Forward request to microservice
 */
export async function forwardToMicroservice(
  service: string,
  payload: unknown,
  headers?: Headers,
): Promise<Response> {
  const url = `${MICROSERVICES_BASE_URL}/${service}`;
  const forwardHeaders = new Headers(headers);
  forwardHeaders.set("Content-Type", "application/json");
  const existingAuth = forwardHeaders.get("Authorization");
  if (!existingAuth || !existingAuth.trim()) {
    forwardHeaders.set("Authorization", `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`);
  }
  forwardHeaders.set("apikey", SUPABASE_SERVICE_ROLE_KEY);
  const correlationId = forwardHeaders.get("X-Correlation-ID") ??
    crypto.randomUUID();
  forwardHeaders.set("X-Correlation-ID", correlationId);
  forwardHeaders.set("X-Routed-From", "wa-webhook");
  forwardHeaders.set("X-Service-Route", service);

  try {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(payload),
      timeoutMs: ROUTER_TIMEOUT_MS,
      retries: ROUTER_RETRY_ATTEMPTS,
      retryDelayMs: ROUTER_RETRY_DELAY_MS,
    });

    console.log(JSON.stringify({
      event: "MESSAGE_ROUTED",
      service,
      status: response.status,
      correlationId,
    }));

    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "ROUTING_ERROR",
      service,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }));
    
    // Return fallback response
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Service temporarily unavailable",
        service 
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Get service health status
 */
export async function checkServiceHealth(service: string): Promise<boolean> {
  try {
    const url = `${MICROSERVICES_BASE_URL}/${service}/health`;
    const response = await fetchWithTimeout(url, {
      method: "GET",
      timeoutMs: ROUTER_TIMEOUT_MS,
      retries: ROUTER_RETRY_ATTEMPTS,
      retryDelayMs: ROUTER_RETRY_DELAY_MS,
    });
    const data = await response.json();
    return data.status === "healthy";
  } catch {
    return false;
  }
}

/**
 * Get all services health
 */
export async function getAllServicesHealth(): Promise<Record<string, boolean>> {
  // Use consolidated ROUTED_SERVICES list, filter out fallback service
  const services = ROUTED_SERVICES.filter(
    (s) => s !== "wa-webhook" && s !== "wa-webhook-core"
  );

  const health: Record<string, boolean> = {};
  
  await Promise.all(
    services.map(async (service) => {
      health[service] = await checkServiceHealth(service);
    })
  );

  return health;
}
