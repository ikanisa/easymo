/**
 * Buy & Sell Agent Configuration
 * 
 * Canonical constants used across all implementations.
 * This is the SINGLE SOURCE OF TRUTH for agent metadata.
 * 
 * @see docs/features/BUY_SELL_CONSOLIDATION_ANALYSIS.md
 */

// =====================================================
// AGENT IDENTITY
// =====================================================

/** Canonical agent slug (used in database ai_agents table) */
export const BUY_SELL_AGENT_SLUG = 'buy_sell';

/** Agent display name */
export const BUY_SELL_AGENT_NAME = 'Buy & Sell AI Agent';

/** Agent type (used in agent_configs.ts) */
export const BUY_SELL_AGENT_TYPE = 'buy_sell';

// =====================================================
// AI MODEL CONFIGURATION
// =====================================================

/** Default AI model */
export const BUY_SELL_DEFAULT_MODEL = 'gemini-1.5-flash';

/** AI temperature (0.0 = deterministic, 1.0 = creative) */
export const BUY_SELL_TEMPERATURE = 0.7;

/** Maximum tokens in response */
export const BUY_SELL_MAX_TOKENS = 1024;

// =====================================================
// SEARCH CONFIGURATION
// =====================================================

import { LOCATION_CONFIG } from '@easymo/location';

/** Default search radius in kilometers - uses centralized config */
export const DEFAULT_SEARCH_RADIUS_KM = LOCATION_CONFIG.MARKETPLACE_RADIUS_METERS / 1000;

/** Default number of search results */
export const DEFAULT_SEARCH_LIMIT = 5;

/** Maximum number of search results */
export const MAX_SEARCH_LIMIT = 20;

// =====================================================
// BUSINESS CATEGORIES
// =====================================================

export const BUSINESS_CATEGORIES = [
  { code: "pharmacy", name: "Pharmacies", icon: "💊", description: "Pharmacies and medical supplies" },
  { code: "salon", name: "Salons & Barbers", icon: "💇", description: "Hair salons, barber shops, beauty services" },
  { code: "restaurant", name: "Restaurants", icon: "🍽️", description: "Restaurants, cafes, and food services" },
  { code: "supermarket", name: "Supermarkets", icon: "🛒", description: "Supermarkets and grocery stores" },
  { code: "hardware", name: "Hardware Stores", icon: "🔧", description: "Hardware stores and construction supplies" },
  { code: "bank", name: "Banks & Finance", icon: "🏦", description: "Banks, microfinance, and mobile money" },
  { code: "hospital", name: "Hospitals & Clinics", icon: "🏥", description: "Hospitals, clinics, and health centers" },
  { code: "hotel", name: "Hotels & Lodging", icon: "🏨", description: "Hotels, guesthouses, and accommodations" },
  { code: "transport", name: "Transport & Logistics", icon: "🚗", description: "Transport services, taxis, and delivery" },
] as const;

export type BusinessCategoryCode = typeof BUSINESS_CATEGORIES[number]['code'];

// =====================================================
// UI HELPERS
// =====================================================

/** Emoji numbers for listing options */
export const EMOJI_NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"] as const;

// =====================================================
// RPC FUNCTION NAMES
// =====================================================

/** AI-powered natural language business search */
export const RPC_SEARCH_BUSINESSES_AI = 'search_businesses_ai';

/** Find nearby businesses by category */
export const RPC_FIND_NEARBY_BUSINESSES = 'find_nearby_businesses';

/** Search businesses nearby (legacy, used by wa-webhook-buy-sell) */
export const RPC_SEARCH_BUSINESSES_NEARBY = 'search_businesses_nearby';

// =====================================================
// MENU KEYS
// =====================================================

/** WhatsApp menu key for category selection workflow */
export const MENU_KEY_BUY_SELL_CATEGORIES = 'buy_sell_categories';

/** WhatsApp menu key for AI chat interface */
export const MENU_KEY_BUSINESS_BROKER_AGENT = 'business_broker_agent';
