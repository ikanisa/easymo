/**
 * Consolidated Route Configuration
 * 
 * Single source of truth for all microservice routing rules.
 * Used by router.ts and routing_logic.ts to prevent inconsistencies.
 */

export interface RouteConfig {
  service: string;
  /** Keywords for natural language matching */
  keywords: string[];
  /** Menu selection keys (exact match) */
  menuKeys: string[];
  /** Priority for conflict resolution (lower = higher priority) */
  priority: number;
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
      "profile", "profile_assets", "my_business", "my_businesses",
      "my_jobs", "my_properties", "saved_locations",
      // Legacy numeric
      "5",
    ],
    priority: 1,
  },
  {
    service: "wa-webhook-marketplace",
    keywords: ["marketplace", "shop", "buy", "sell", "store", "product", "business", "broker"],
    menuKeys: ["marketplace", "shops_services", "buy_and_sell", "buy and sell", "business_broker_agent", "general_broker", "6"],
    priority: 1,
  },
  {
    service: "wa-webhook-ai-agents",
    keywords: ["agent", "chat", "help", "support", "ask", "farmer", "waiter", "restaurant", "bar", "food"],
    menuKeys: [
      "ai_agents", 
      "farmer_agent",    // Farmers Market
      "sales_agent",     // Help Center
      "waiter_agent",    // Bar & Restaurants
      "waiter", 
      "support", 
      "customer_support", 
      "farmers", 
      "7"
    ],
    priority: 3, // Lower priority so specific services match first
  },
];

/**
 * List of all routed services (for health checks, validation, etc.)
 */
export const ROUTED_SERVICES: readonly string[] = [
  "wa-webhook-jobs",
  "wa-webhook-marketplace",
  "wa-webhook-ai-agents",
  "wa-webhook-property",
  "wa-webhook-mobility",
  "wa-webhook-profile",
  "wa-webhook-insurance",
  "wa-webhook", // Legacy fallback
  "wa-webhook-core",
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
  { patterns: ["marketplace", "shop_"], service: "wa-webhook-marketplace" },
  { patterns: ["agent", "ai_", "farmer_", "waiter_"], service: "wa-webhook-ai-agents" },
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
