// Traffic Router for wa-webhook microservices
// Routes incoming WhatsApp messages to appropriate microservice based on domain

const MICROSERVICES_BASE_URL = Deno.env.get("SUPABASE_URL") + "/functions/v1";

interface RouteConfig {
  service: string;
  keywords: string[];
  priority: number;
}

// Define routing rules
const ROUTES: RouteConfig[] = [
  {
    service: "wa-webhook-jobs",
    keywords: ["job", "work", "employment", "hire", "career", "apply", "cv", "resume"],
    priority: 1,
  },
  {
    service: "wa-webhook-mobility",
    keywords: ["ride", "trip", "driver", "taxi", "transport", "schedule", "book", "nearby"],
    priority: 1,
  },
  {
    service: "wa-webhook-property",
    keywords: ["property", "rent", "house", "apartment", "rental", "landlord", "tenant"],
    priority: 1,
  },
  {
    service: "wa-webhook-marketplace",
    keywords: ["buy", "sell", "marketplace", "shop", "product", "listing"],
    priority: 2,
  },
  {
    service: "wa-webhook-wallet",
    keywords: ["wallet", "payment", "pay", "balance", "deposit", "withdraw", "money"],
    priority: 1,
  },
  {
    service: "wa-webhook-ai-agents",
    keywords: ["agent", "chat", "help", "support", "ask"],
    priority: 3,
  },
];

/**
 * Route message to appropriate microservice
 */
export async function routeMessage(
  messageText: string,
  chatState?: string
): Promise<string> {
  const text = messageText.toLowerCase();

  // 1. Check chat state first (user is in a flow)
  if (chatState) {
    const stateService = getServiceFromState(chatState);
    if (stateService) {
      return stateService;
    }
  }

  // 2. Match keywords
  const matches = ROUTES.map((route) => ({
    service: route.service,
    score: route.keywords.filter((kw) => text.includes(kw)).length,
    priority: route.priority,
  })).filter((m) => m.score > 0);

  if (matches.length > 0) {
    // Sort by score (descending), then by priority (ascending)
    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.priority - b.priority;
    });
    return matches[0].service;
  }

  // 3. Default to core service (handles general queries)
  return "wa-webhook-core";
}

/**
 * Get service from chat state
 */
function getServiceFromState(chatState: string): string | null {
  if (chatState.includes("jobs") || chatState.includes("job_")) {
    return "wa-webhook-jobs";
  }
  if (chatState.includes("mobility") || chatState.includes("trip_")) {
    return "wa-webhook-mobility";
  }
  if (chatState.includes("property") || chatState.includes("rental_")) {
    return "wa-webhook-property";
  }
  if (chatState.includes("marketplace") || chatState.includes("listing_")) {
    return "wa-webhook-marketplace";
  }
  if (chatState.includes("wallet") || chatState.includes("payment_")) {
    return "wa-webhook-wallet";
  }
  return null;
}

/**
 * Forward request to microservice
 */
export async function forwardToMicroservice(
  service: string,
  payload: any,
  headers: Headers
): Promise<Response> {
  const url = `${MICROSERVICES_BASE_URL}/${service}`;
  
  const forwardHeaders = new Headers();
  forwardHeaders.set("Content-Type", "application/json");
  forwardHeaders.set("Authorization", headers.get("Authorization") || "");
  forwardHeaders.set("X-Correlation-ID", headers.get("X-Correlation-ID") || crypto.randomUUID());
  forwardHeaders.set("X-Routed-From", "wa-webhook");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(payload),
    });

    console.log(JSON.stringify({
      event: "MESSAGE_ROUTED",
      service,
      status: response.status,
      correlationId: forwardHeaders.get("X-Correlation-ID"),
    }));

    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "ROUTING_ERROR",
      service,
      error: error instanceof Error ? error.message : String(error),
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
    const response = await fetch(url, { method: "GET" });
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
  const services = [
    "wa-webhook-jobs",
    "wa-webhook-mobility",
    "wa-webhook-property",
    "wa-webhook-marketplace",
    "wa-webhook-wallet",
    "wa-webhook-ai-agents",
    "wa-webhook-core",
  ];

  const health: Record<string, boolean> = {};
  
  await Promise.all(
    services.map(async (service) => {
      health[service] = await checkServiceHealth(service);
    })
  );

  return health;
}
