/**
 * WhatsApp Home Menu Key Aliases
 * 
 * Maps legacy menu item keys to their canonical agent keys.
 * This ensures backward compatibility for users/flows that might still
 * reference old menu items.
 * 
 * After cleanup, only 9 items are active in whatsapp_home_menu_items:
 * - 8 AI Agents: waiter, rides, jobs, business_broker, real_estate, farmer, insurance, sales
 * - 1 Profile: profile
 * 
 * All legacy items (20+ old keys) are soft-deleted (is_active=false) but
 * routing is preserved via these aliases.
 */

export const HOME_MENU_KEY_ALIASES: Record<string, string> = {
  // ========================================
  // RIDES AI AGENT ALIASES
  // ========================================
  'schedule_trip': 'rides_agent',
  'nearby_drivers': 'rides_agent',
  'nearby_passengers': 'rides_agent',
  'rides': 'rides_agent',
  'driver_negotiation': 'rides_agent',
  
  // ========================================
  // JOBS AI AGENT ALIASES
  // ========================================
  'jobs_gigs': 'jobs_agent',
  'jobs_and_gigs': 'jobs_agent',
  'gigs': 'jobs_agent',
  
  // ========================================
  // WAITER AI AGENT ALIASES
  // ========================================
  'bars_restaurants': 'waiter_agent',
  'bars_and_restaurants': 'waiter_agent',
  'restaurants': 'waiter_agent',
  'bars': 'waiter_agent',
  
  // ========================================
  // BUSINESS BROKER AI AGENT ALIASES
  // ========================================
  'business_finder': 'business_broker_agent',
  'general_broker': 'business_broker_agent',
  'nearby_pharmacies': 'business_broker_agent',
  'pharmacies': 'business_broker_agent',
  'quincailleries': 'business_broker_agent',
  'shops_services': 'business_broker_agent',
  'shops_and_services': 'business_broker_agent',
  'notary_services': 'business_broker_agent',
  'notary': 'business_broker_agent',
  
  // ========================================
  // REAL ESTATE AI AGENT ALIASES
  // ========================================
  'property_ai': 'real_estate_agent',
  'property_rentals': 'real_estate_agent',
  'properties': 'real_estate_agent',
  'real_estate': 'real_estate_agent',
  
  // ========================================
  // INSURANCE AI AGENT ALIASES
  // ========================================
  'motor_insurance': 'insurance_agent',
  'insurance': 'insurance_agent',
  
  // ========================================
  // PROFILE ALIASES
  // ========================================
  'my_profile': 'profile',
  'my_profile_assets': 'profile',
  'profile_assets': 'profile',
  'momo_qr': 'profile',
  'momo_qr_code': 'profile',
  'token_transfer': 'profile',
  'wallet': 'profile',
  'qr_code': 'profile',
  
  // ========================================
  // SALES SDR AI AGENT ALIASES
  // ========================================
  'sales_ai': 'sales_agent',
  'customer_support': 'sales_agent',
  'support': 'sales_agent',
};

/**
 * Normalizes a menu key to its canonical agent key
 */
export function normalizeMenuKey(key: string): string {
  return HOME_MENU_KEY_ALIASES[key] || key;
}

/**
 * Checks if a key is a legacy (aliased) key
 */
export function isLegacyMenuKey(key: string): boolean {
  return key in HOME_MENU_KEY_ALIASES;
}

/**
 * The 9 canonical menu keys (in display order)
 */
export const CANONICAL_MENU_KEYS = [
  'waiter_agent',
  'rides_agent',
  'jobs_agent',
  'business_broker_agent',
  'real_estate_agent',
  'farmer_agent',
  'insurance_agent',
  'sales_agent',
  'profile',
] as const;

export type CanonicalMenuKey = typeof CANONICAL_MENU_KEYS[number];

/**
 * Validates if a key is a canonical menu key
 */
export function isCanonicalMenuKey(key: string): key is CanonicalMenuKey {
  return CANONICAL_MENU_KEYS.includes(key as CanonicalMenuKey);
}
