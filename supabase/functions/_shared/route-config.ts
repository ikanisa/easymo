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
    service: "wa-webhook-buy-sell",
    keywords: ["buy", "sell", "category", "categories", "browse", "directory", "shops", "business", "marketplace", "support", "help", "issue", "problem", "question", "faq"],
    menuKeys: ["buy_sell", "buy_and_sell", "buy and sell", "shops_services", "marketplace", "3", "support_agent", "support", "customer_support", "help", "4"],
    priority: 1,
  },
  {
    service: "wa-webhook-insurance",
    keywords: ["insurance", "insure", "policy", "coverage", "quote", "motor insurance"],
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
  "wa-webhook-wallet",
  "wa-webhook-buy-sell",
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
  { patterns: ["wallet_", "payment_", "transfer_", "momo_qr_"], service: "wa-webhook-wallet" },
  { patterns: ["shop_", "buy_sell_", "buy_sell_location", "buy_sell_results", "buy_sell_menu", "business_", "directory_", "support_"], service: "wa-webhook-buy-sell" },
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


