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
    menuKeys: [
      // Database menu keys (primary)
      "rides", "rides_agent",
      // Legacy/alternative keys
      "mobility", "nearby_drivers", "nearby_passengers", "schedule_trip", "1",
    ],
    priority: 1,
  },
  {
    // Wallet service - handled by wa-webhook-profile
    // Wallet operations are part of profile service (not a separate microservice)
    service: "wa-webhook-profile",
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
    // Buy & Sell + Support - consolidated marketplace service
    // Support functionality merged here per comprehensive cleanup (Phase 2)
    // Handles both marketplace transactions and customer support inquiries
    service: "notify-buyers",
    keywords: [
      // Marketplace keywords
      "buy", "sell", "category", "categories", "browse", "directory", "shops", "business", "marketplace",
      // Support keywords (consolidated from wa-agent-support)
      "support", "help", "issue", "problem", "question", "faq",
    ],
    menuKeys: [
      // Marketplace menu keys (aligned with database keys)
      "buy_sell", "buy_and_sell", "buy and sell", "business_broker_agent", "buy_and_sell_agent",
      // Legacy menu keys
      "shops_services", "marketplace", "3",
      // Support menu keys (consolidated from wa-agent-support)
      "support_agent", "support", "customer_support", "help", "4",
    ],
    priority: 1,
  },
  {
    // Insurance - handled inline by router, not a separate service
    service: "wa-webhook-core",
    keywords: ["insure", "policy", "coverage", "quote", "motor insurance"],
    menuKeys: ["insurance", "motor_insurance"],
    priority: 1,
  },
];

/**
 * List of all routed services (for health checks, validation, etc.)
 * 
 * EasyMO Rwanda-only services:
 * - Mobility, Buy & Sell, Insurance, Profile, Wallet
 */
export const ROUTED_SERVICES: readonly string[] = [
  "wa-webhook-core",
  "wa-webhook-mobility",
  "wa-webhook-insurance",
  "wa-webhook-profile",
  "notify-buyers",
  "wa-webhook-voice-calls",
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
 * Note: Support patterns consolidated into buy-sell per comprehensive cleanup
 */
export const STATE_PATTERNS: Array<{ patterns: string[]; service: string }> = [
  { patterns: ["mobility", "trip_", "ride_"], service: "wa-webhook-mobility" },
  { patterns: ["wallet_", "payment_", "transfer_", "momo_qr_"], service: "wa-webhook-profile" },
  { 
    patterns: [
      // Marketplace patterns
      "shop_", "buy_sell_", "buy_sell_location", "buy_sell_results", "buy_sell_menu", "business_", "directory_",
      // Support patterns (consolidated from wa-agent-support)
      "support_",
    ],
    service: "notify-buyers",
  },
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


