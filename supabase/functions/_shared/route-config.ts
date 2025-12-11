/**
 * Consolidated Route Configuration
 * 
 * Single source of truth for all microservice routing rules.
 * Used by router.ts and routing_logic.ts to prevent inconsistencies.
 * 
 * ## Consolidation in Progress
 * 
 * The following services are being consolidated into wa-webhook-unified:
 * - wa-webhook-ai-agents (Farmer, Waiter, Support, Insurance, Rides, Sales, Broker)
 * - wa-webhook-marketplace (Buy/Sell, Shops, Payments)
 * 
 * When FEATURE_AGENT_UNIFIED_WEBHOOK is enabled, traffic will be routed to wa-webhook-unified
 * instead of the legacy services.
 * 
 * @see docs/WA_WEBHOOK_CONSOLIDATION.md for migration details
 */

export interface RouteConfig {
  service: string;
  /** Keywords for natural language matching */
  keywords: string[];
  /** Menu selection keys (exact match) */
  menuKeys: string[];
  /** Priority for conflict resolution (lower = higher priority) */
  priority: number;
  /** 
   * If true, this service is deprecated and traffic should be routed to
   * wa-webhook-unified when FEATURE_AGENT_UNIFIED_WEBHOOK is enabled.
   */
  deprecated?: boolean;
  /** The service to redirect to when deprecated */
  redirectTo?: string;
}

/**
 * All microservice route configurations
 */
export const ROUTE_CONFIGS: RouteConfig[] = [
  {
    service: "wa-webhook-mobility",
    keywords: ["ride", "trip", "driver", "taxi", "transport", "schedule", "book", "nearby", "delivery"],
    menuKeys: ["rides", "mobility", "rides_agent", "nearby_drivers", "nearby_passengers", "schedule_trip", "1"],
    priority: 1,
  },
  {
    service: "wa-webhook-insurance",
    keywords: ["insurance", "assurance", "cover", "claim", "policy", "premium", "insure", "protection"],
    menuKeys: ["insurance", "insurance_agent", "motor_insurance", "insurance_submit", "insurance_help", "motor_insurance_upload", "2"],
    priority: 1,
  },
  {
    service: "wa-webhook-jobs",
    keywords: ["job", "work", "employment", "hire", "career", "apply", "cv", "resume", "gig", "gigs"],
    menuKeys: ["jobs", "jobs_agent", "3"],
    priority: 1,
  },
  {
    service: "wa-webhook-property",
    keywords: ["property", "rent", "house", "apartment", "rental", "landlord", "tenant", "real estate"],
    menuKeys: ["property", "property_rentals", "property rentals", "real_estate_agent", "4"],
    priority: 1,
  },
  {
    // Profile service handles both user profile and wallet functionality
    // This consolidation simplifies the architecture - "wallet" is now part of "profile"
    service: "wa-webhook-profile",
    keywords: [
      // Wallet/financial keywords
      "wallet", "token", "transfer", "redeem", "earn", "reward", "balance",
      "payment", "pay", "deposit", "withdraw", "money", "referral", "share",
      // Profile keywords
      "profile", "account", "my account",
    ],
    menuKeys: [
      // Wallet menu keys
      "wallet", "token_transfer", "momo_qr", "momo qr", "momoqr",
      // Profile menu keys
      "profile", "my_account", "my account", "account", "profile_assets", 
      "my_business", "my_businesses",
      "my_jobs", "my_properties", "saved_locations",
      // Legacy numeric
      "5",
    ],
    priority: 1,
  },
  {
    // Directory service: Structured category browsing and location-based business search
    service: "wa-webhook-buy-sell-directory",
    keywords: ["buy", "sell", "category", "categories", "browse", "directory", "shops"],
    menuKeys: ["buy_sell_directory", "buy_sell_categories", "buy_and_sell", "buy and sell", "shops_services", "directory", "browse_categories", "6"],
    priority: 1,
  },
  {
    // AI Agent service: Natural language business discovery
    service: "wa-webhook-buy-sell-agent",
    keywords: ["business broker", "find business", "shopping assistant", "ai search", "chat agent"],
    menuKeys: ["buy_sell_agent", "business_broker_agent", "chat_with_agent", "marketplace_agent", "shop_ai", "ai_assistant"],
    priority: 1,
  },
  {
    // Legacy service - redirects to directory service
    service: "wa-webhook-buy-sell",
    keywords: [],
    menuKeys: [],
    priority: 99,
    deprecated: true,
    redirectTo: "wa-webhook-buy-sell-directory",
  },
  {
    // Legacy agent-buy-sell endpoint
    service: "agent-buy-sell",
    keywords: [],
    menuKeys: [],
    priority: 99,
  },
  {
    service: "wa-agent-farmer",
    keywords: ["farmer", "agriculture", "crop", "harvest", "seed", "fertilizer"],
    menuKeys: ["farmer_agent", "farmers", "farmers_market"],
    priority: 2,
  },
  {
    service: "wa-agent-support",
    keywords: ["support", "help", "issue", "problem", "question", "faq"],
    menuKeys: ["support_agent", "support", "customer_support", "help", "7"],
    priority: 2,
  },
  {
    service: "wa-agent-waiter",
    keywords: ["waiter", "restaurant", "bar", "food", "menu", "order", "reservation"],
    menuKeys: ["waiter_agent", "waiter", "restaurant"],
    priority: 2,
  },
  {
    service: "agent-property-rental",
    keywords: ["property", "rental", "rent", "house", "apartment", "lease", "accommodation"],
    menuKeys: ["property_agent", "rental_agent", "property_rental", "real_estate"],
    priority: 2,
  },
  {
    service: "wa-agent-call-center",
    keywords: ["agent", "chat", "ask", "call center", "universal", "marketplace"],
    menuKeys: ["ai_agents", "call_center", "universal_agent"],
    priority: 3, // Fallback for general AI queries
  },
];

/**
 * List of all routed services (for health checks, validation, etc.)
 */
export const ROUTED_SERVICES: readonly string[] = [
  "wa-webhook-mobility",
  "wa-webhook-insurance",
  "wa-webhook-jobs",
  "wa-webhook-property",
  "wa-webhook-profile",
  "wa-webhook-buy-sell",
  "wa-webhook-buy-sell-directory",
  "wa-webhook-buy-sell-agent",
  "wa-webhook-waiter",
  "wa-agent-farmer",
  "wa-agent-support",
  "wa-agent-waiter",
  "agent-buy-sell",
  "agent-property-rental",
  "wa-agent-call-center",
  "wa-webhook-core",
  "wa-webhook", // Legacy fallback
] as const;

export type RoutedService = typeof ROUTED_SERVICES[number];

/**
 * Build a lookup map from menu keys to services
 */
export function buildMenuKeyMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const config of ROUTE_CONFIGS) {
    for (const key of config.menuKeys) {
      map[key.toLowerCase()] = config.service;
    }
  }
  return map;
}

/**
 * State-based routing patterns
 */
export const STATE_PATTERNS: Array<{ patterns: string[]; service: string }> = [
  { patterns: ["insurance", "ins_"], service: "wa-webhook-insurance" },
  { patterns: ["jobs", "job_"], service: "wa-webhook-jobs" },
  { patterns: ["mobility", "trip_", "ride_"], service: "wa-webhook-mobility" },
  { patterns: ["property", "rental_"], service: "wa-webhook-property" },
  { patterns: ["wallet", "payment_", "transfer_"], service: "wa-webhook-profile" },
  // New directory service state patterns
  { patterns: ["directory_category", "directory_results", "directory_menu_pagination"], service: "wa-webhook-buy-sell-directory" },
  // New agent service state patterns
  { patterns: ["agent_chat", "business_broker_chat"], service: "wa-webhook-buy-sell-agent" },
  // Legacy buy/sell patterns - route to directory
  { patterns: ["shop_", "buy_sell_", "buy_sell_location", "buy_sell_results", "buy_sell_menu"], service: "wa-webhook-buy-sell-directory" },
  { patterns: ["waiter_workflow_"], service: "wa-webhook-waiter" },
  { patterns: ["farmer_"], service: "wa-agent-farmer" },
  { patterns: ["support_"], service: "wa-agent-support" },
  { patterns: ["waiter_", "restaurant_"], service: "wa-agent-waiter" },
  { patterns: ["buy_sell_agent_"], service: "wa-webhook-buy-sell-agent" },
  { patterns: ["property_agent_", "rental_agent_"], service: "agent-property-rental" },
  { patterns: ["agent_", "call_center_"], service: "wa-agent-call-center" },
];

/**
 * Get service from chat state
 */
export function getServiceFromState(chatState: string): string | null {
  const lowerState = chatState.toLowerCase();
  for (const { patterns, service } of STATE_PATTERNS) {
    for (const pattern of patterns) {
      if (lowerState.includes(pattern)) {
        return service;
      }
    }
  }
  return null;
}

/**
 * Match message text to service based on keywords
 * Returns the best matching service or null if no match
 */
export function matchKeywordsToService(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  const matches = ROUTE_CONFIGS.map((config) => ({
    service: config.service,
    score: config.keywords.filter((kw) => lowerText.includes(kw)).length,
    priority: config.priority,
  })).filter((m) => m.score > 0);

  if (matches.length === 0) {
    return null;
  }

  // Sort by score (descending), then by priority (ascending)
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.priority - b.priority;
  });

  return matches[0].service;
}

/**
 * Check if a service is deprecated
 */
export function isServiceDeprecated(service: string): boolean {
  const config = ROUTE_CONFIGS.find((c) => c.service === service);
  return config?.deprecated === true;
}

/**
 * Get the redirect target for a deprecated service
 * Returns the original service if not deprecated or no redirect configured
 */
export function getServiceRedirect(service: string): string {
  const config = ROUTE_CONFIGS.find((c) => c.service === service);
  if (config?.deprecated && config?.redirectTo) {
    return config.redirectTo;
  }
  return service;
}

/**
 * Resolve the final service to route to, taking into account deprecation
 * and the FEATURE_UNIFIED_AGENTS feature flag.
 * 
 * When useUnified is true and the service is deprecated, returns the redirect target.
 * When useUnified is false, always returns the original service (even if deprecated).
 * When the service is not deprecated, always returns the original service.
 * 
 * @param service - The originally matched service
 * @param useUnified - Whether to redirect deprecated services to the unified service
 * @returns The final service to route to
 */
export function resolveServiceWithMigration(service: string, useUnified: boolean): string {
  // When unified routing is disabled, always use the original service
  if (!useUnified) {
    return service;
  }
  
  // When unified routing is enabled, check if service has a redirect configured
  const config = ROUTE_CONFIGS.find((c) => c.service === service);
  if (config?.deprecated && config?.redirectTo) {
    return config.redirectTo;
  }
  
  // Service is not deprecated or has no redirect, use original
  return service;
}

/**
 * Services that are being consolidated into wa-webhook-unified
 * Used for monitoring and migration tracking
 */
export const DEPRECATED_SERVICES = ROUTE_CONFIGS
  .filter((c) => c.deprecated)
  .map((c) => c.service);

/**
 * The unified service that replaces deprecated services
 */
export const UNIFIED_SERVICE = "wa-webhook-unified";
