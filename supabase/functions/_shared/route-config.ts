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
  /** If true, this service is deprecated */
  deprecated?: boolean;
  /** The service to redirect to when deprecated */
  redirectTo?: string;
}

/**
 * All microservice route configurations
 * 
 * EasyMO supports only the following services (Rwanda only):
 * - Mobility (rides/transport)
 * - Buy & Sell (marketplace with AI agent)
 * - Insurance
 * - Profile (with vehicles, MOMO QR, favorite locations)
 * - Wallet
 */
export const ROUTE_CONFIGS: RouteConfig[] = [
  {
    service: "wa-webhook-mobility",
    keywords: ["ride", "trip", "driver", "taxi", "transport", "schedule", "book", "nearby", "delivery"],
    menuKeys: ["rides", "mobility", "rides_agent", "nearby_drivers", "nearby_passengers", "schedule_trip", "1"],
    priority: 1,
  },
  {
    // Wallet service - dedicated microservice for financial operations
    // Extracted from wa-webhook-profile for single-responsibility
    service: "wa-webhook-wallet",
    keywords: [
      "wallet", "token", "transfer", "redeem", "earn", "reward", "balance",
      "payment", "pay", "deposit", "withdraw", "money", "referral", "cashout", "cash out",
      "momo", "qr",
    ],
    menuKeys: [
      "wallet", "wallet_tokens", "token_transfer", "momo_qr", "momo qr", "momoqr",
      "wallet_earn", "wallet_transfer", "wallet_redeem", "wallet_transactions",
    ],
    priority: 1,
  },
  {
    // Profile service - user profile, settings, vehicles, and favorite locations
    service: "wa-webhook-profile",
    keywords: [
      // Profile keywords
      "profile", "account", "my account", "settings", "vehicle", "vehicles",
    ],
    menuKeys: [
      // Profile menu keys
      "profile", "my_account", "my account", "account", "profile_assets", 
      "my_vehicles", "saved_locations", "favorite_locations",
      // Legacy numeric
      "5",
    ],
    priority: 1,
  },
  {
    // Directory service: Structured category browsing and location-based business search
    service: "wa-webhook-buy-sell-directory",
    keywords: ["buy", "sell", "category", "categories", "browse", "directory", "shops"],
    menuKeys: ["buy_sell_directory", "buy_sell_categories", "buy_and_sell", "buy and sell", "shops_services", "directory", "browse_categories", "3"],
    priority: 1,
  },
  {
    // AI Agent service: Natural language business discovery (only AI agent kept)
    service: "wa-webhook-buy-sell-agent",
    keywords: ["business broker", "find business", "shopping assistant", "ai search", "chat agent"],
    menuKeys: ["buy_sell_agent", "business_broker_agent", "chat_with_agent", "marketplace_agent", "shop_ai", "ai_assistant"],
    priority: 1,
  },
  {
    /**
     * Legacy Buy & Sell service - DEPRECATED
     * 
     * This service is deprecated and traffic should be routed to wa-webhook-buy-sell-directory.
     */
    service: "wa-webhook-buy-sell",
    keywords: [], // Intentionally empty - deprecated service
    menuKeys: [],  // Intentionally empty - deprecated service
    priority: 99,
    deprecated: true,
    redirectTo: "wa-webhook-buy-sell-directory",
  },
  {
    /**
     * Buy-Sell AI Agent endpoint (only AI agent kept)
     */
    service: "agent-buy-sell",
    keywords: [], // Intentionally empty - access via wa-webhook-buy-sell-agent
    menuKeys: [],  // Intentionally empty - access via wa-webhook-buy-sell-agent
    priority: 99,
  },
  {
    service: "wa-agent-support",
    keywords: ["support", "help", "issue", "problem", "question", "faq"],
    menuKeys: ["support_agent", "support", "customer_support", "help", "4"],
    priority: 2,
  },
];

/**
 * List of all routed services (for health checks, validation, etc.)
 * 
 * EasyMO Rwanda-only services:
 * - Mobility, Buy & Sell, Profile, Wallet
 */
export const ROUTED_SERVICES: readonly string[] = [
  "wa-webhook-mobility",
  "wa-webhook-profile",
  "wa-webhook-wallet",
  "wa-webhook-buy-sell",
  "wa-webhook-buy-sell-directory",
  "wa-webhook-buy-sell-agent",
  "agent-buy-sell",
  "wa-agent-support",
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
 * 
 * EasyMO Rwanda-only services
 */
export const STATE_PATTERNS: Array<{ patterns: string[]; service: string }> = [
  { patterns: ["mobility", "trip_", "ride_"], service: "wa-webhook-mobility" },
  // Wallet state patterns - route to dedicated wallet service
  // Note: wallet_ prefix catches wallet_cashout, wallet_purchase, wallet_referral, wallet_transfer, etc.
  { patterns: ["wallet_", "payment_", "transfer_", "momo_qr_"], service: "wa-webhook-wallet" },
  // New directory service state patterns
  { patterns: ["directory_category", "directory_results", "directory_menu_pagination"], service: "wa-webhook-buy-sell-directory" },
  // New agent service state patterns
  { patterns: ["agent_chat", "business_broker_chat"], service: "wa-webhook-buy-sell-agent" },
  // Legacy buy/sell patterns - route to directory
  { patterns: ["shop_", "buy_sell_", "buy_sell_location", "buy_sell_results", "buy_sell_menu"], service: "wa-webhook-buy-sell-directory" },
  { patterns: ["support_"], service: "wa-agent-support" },
  { patterns: ["buy_sell_agent_"], service: "wa-webhook-buy-sell-agent" },
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
 * Services that are deprecated
 * Used for monitoring and migration tracking
 */
export const DEPRECATED_SERVICES = ROUTE_CONFIGS
  .filter((c) => c.deprecated)
  .map((c) => c.service);
