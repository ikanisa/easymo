import type { RouterContext } from "../../types.ts";
import { supabase } from "../../config.ts";
import type { SupabaseClient } from "../../deps.ts";
import { getOrSetCached } from "../../utils/cache.ts";

const MENU_CACHE_ENABLED =
  (Deno.env.get("WA_MENU_CACHE_ENABLED") ?? "true").toLowerCase() !== "false";
const MENU_CACHE_TTL_SECONDS = Math.max(
  Number(Deno.env.get("WA_MENU_CACHE_TTL_SECONDS") ?? "420") || 420,
  60,
);

export type MenuItemKey =
  // 8 AI Agents (aligned with ai_agents table)
  | "waiter_agent"
  | "rides_agent"
  | "jobs_agent"
  | "business_broker_agent"
  | "real_estate_agent"
  | "farmer_agent"
  | "insurance_agent"
  | "sales_agent"
  // Profile (not an agent)
  | "profile"
  // Legacy keys (kept for backward compatibility, marked as deprecated)
  | "jobs" // @deprecated Use jobs_agent
  | "jobs_gigs" // @deprecated Use jobs_agent
  | "rides" // @deprecated Use rides_agent
  | "nearby_drivers" // @deprecated Covered by rides_agent
  | "nearby_passengers" // @deprecated Covered by rides_agent
  | "schedule_trip" // @deprecated Covered by rides_agent
  | "motor_insurance" // @deprecated Use insurance_agent
  | "nearby_pharmacies" // @deprecated Covered by business_broker_agent
  | "quincailleries" // @deprecated Covered by business_broker_agent
  | "shops_services" // @deprecated Covered by business_broker_agent
  | "property_rentals" // @deprecated Use real_estate_agent
  | "momo_qr" // @deprecated Moved to separate payment flow
  | "bars_restaurants" // @deprecated Use waiter_agent
  | "notary_services" // @deprecated Covered by business_broker_agent
  | "profile_assets" // @deprecated Use profile
  | "token_transfer" // @deprecated Moved to wallet
  | "general_broker" // @deprecated Use business_broker_agent
  | "customer_support"; // @deprecated Accessed via support flow

export interface WhatsAppHomeMenuItem {
  id: string;
  name: string;
  key: MenuItemKey;
  is_active: boolean;
  active_countries: string[];
  display_order: number;
  icon: string | null;
  country_specific_names: Record<string, { name?: string; description?: string }> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get localized menu item name for a specific country
 */
export function getLocalizedMenuName(
  item: WhatsAppHomeMenuItem,
  countryCode: string,
): string {
  if (item.country_specific_names && item.country_specific_names[countryCode]) {
    return item.country_specific_names[countryCode].name || item.name;
  }
  return item.name;
}

/**
 * Fetch active menu items from database filtered by country
 * Returns items with country-specific names applied
 */
export async function fetchActiveMenuItems(
  countryCode: string,
  client?: SupabaseClient,
): Promise<WhatsAppHomeMenuItem[]> {
  const db = client || supabase;
  const cacheKey = `menu:home:${countryCode}`;

  const fetcher = async (): Promise<WhatsAppHomeMenuItem[]> => {
    const { data, error } = await db
      .from("whatsapp_home_menu_items")
      .select("*")
      .eq("is_active", true)
      .contains("active_countries", [countryCode])
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Failed to fetch menu items:", error);
      // Return empty array on error, fallback will handle it
      return [];
    }

    const items = (data || []) as WhatsAppHomeMenuItem[];
    return items.map(item => ({
      ...item,
      name: getLocalizedMenuName(item, countryCode),
    }));
  };

  if (!MENU_CACHE_ENABLED) {
    return await fetcher();
  }

  return await getOrSetCached(cacheKey, fetcher, MENU_CACHE_TTL_SECONDS);
}

/**
 * Alias mapping from legacy menu keys to canonical agent keys.
 * Used for backward compatibility when old keys are referenced in code or user sessions.
 * After cleanup migration (2025-11-22), only 9 canonical keys are active in DB:
 * waiter_agent, rides_agent, jobs_agent, business_broker_agent, real_estate_agent,
 * farmer_agent, insurance_agent, sales_agent, profile.
 */
export const HOME_MENU_KEY_ALIASES: Record<string, string> = {
  // Canonical keys (9 active items) - map to themselves
  waiter_agent: "waiter_agent",
  rides_agent: "rides_agent",
  jobs_agent: "jobs_agent",
  business_broker_agent: "business_broker_agent",
  real_estate_agent: "real_estate_agent",
  farmer_agent: "farmer_agent",
  insurance_agent: "insurance_agent",
  sales_agent: "sales_agent",
  profile: "profile",
  
  // Legacy aliases - route to canonical agents
  schedule_trip: "rides_agent",
  nearby_drivers: "rides_agent",
  nearby_passengers: "rides_agent",
  rides: "rides_agent",
  jobs_gigs: "jobs_agent",
  jobs: "jobs_agent",
  bars_restaurants: "waiter_agent",
  nearby_pharmacies: "business_broker_agent",
  quincailleries: "business_broker_agent",
  shops_services: "business_broker_agent",
  notary_services: "business_broker_agent",
  general_broker: "business_broker_agent",
  property_rentals: "real_estate_agent",
  motor_insurance: "insurance_agent",
  momo_qr: "profile",  // Payment QR accessed via profile
  token_transfer: "profile",  // Wallet transfers via profile
  profile_assets: "profile",
  customer_support: "sales_agent",  // Support routed to sales agent
};

/**
 * Normalize a menu key (legacy or canonical) to its canonical agent key.
 * @param key - Menu item key (can be legacy or canonical)
 * @returns Canonical agent key
 */
export function normalizeMenuKey(key: string): string {
  return HOME_MENU_KEY_ALIASES[key] || key;
}

/**
 * Map menu item keys to IDS constants
 * @deprecated Use normalizeMenuKey instead for cleaner semantic
 */
export function getMenuItemId(key: MenuItemKey): string {
  const mapping: Record<MenuItemKey, string> = {
    // 8 AI Agents
    waiter_agent: "waiter_agent",
    rides_agent: "rides_agent",
    jobs_agent: "jobs_agent",
    business_broker_agent: "business_broker_agent",
    real_estate_agent: "real_estate_agent",
    farmer_agent: "farmer_agent",
    insurance_agent: "insurance_agent",
    sales_agent: "sales_agent",
    // Profile
    profile: "profile",
    // Legacy mappings (backward compatibility)
    jobs: "jobs_agent",
    jobs_gigs: "jobs_agent",
    rides: "rides_agent",
    nearby_drivers: "rides_agent",
    nearby_passengers: "rides_agent",
    schedule_trip: "rides_agent",
    motor_insurance: "insurance_agent",
    nearby_pharmacies: "business_broker_agent",
    quincailleries: "business_broker_agent",
    shops_services: "business_broker_agent",
    property_rentals: "real_estate_agent",
    momo_qr: "momoqr_start",
    bars_restaurants: "waiter_agent",
    notary_services: "business_broker_agent",
    profile_assets: "profile",
    token_transfer: "wallet_transfer",
    general_broker: "business_broker_agent",
    customer_support: "customer_support",
  };

  return mapping[key] || key;
}

/**
 * Get translation key for menu item
 */
export function getMenuItemTranslationKeys(
  key: MenuItemKey,
): { titleKey: string; descriptionKey: string } {
  const mapping: Record<
    MenuItemKey,
    { titleKey: string; descriptionKey: string }
  > = {
    // 8 AI Agents
    waiter_agent: {
      titleKey: "home.rows.waiterAgent.title",
      descriptionKey: "home.rows.waiterAgent.description",
    },
    rides_agent: {
      titleKey: "home.rows.ridesAgent.title",
      descriptionKey: "home.rows.ridesAgent.description",
    },
    jobs_agent: {
      titleKey: "home.rows.jobsAgent.title",
      descriptionKey: "home.rows.jobsAgent.description",
    },
    business_broker_agent: {
      titleKey: "home.rows.businessBrokerAgent.title",
      descriptionKey: "home.rows.businessBrokerAgent.description",
    },
    real_estate_agent: {
      titleKey: "home.rows.realEstateAgent.title",
      descriptionKey: "home.rows.realEstateAgent.description",
    },
    farmer_agent: {
      titleKey: "home.rows.farmerAgent.title",
      descriptionKey: "home.rows.farmerAgent.description",
    },
    insurance_agent: {
      titleKey: "home.rows.insuranceAgent.title",
      descriptionKey: "home.rows.insuranceAgent.description",
    },
    sales_agent: {
      titleKey: "home.rows.salesAgent.title",
      descriptionKey: "home.rows.salesAgent.description",
    },
    // Profile
    profile: {
      titleKey: "home.rows.profile.title",
      descriptionKey: "home.rows.profile.description",
    },
    // Legacy mappings (backward compatibility)
    jobs: {
      titleKey: "home.rows.jobs.title",
      descriptionKey: "home.rows.jobs.description",
    },
    jobs_gigs: {
      titleKey: "home.rows.jobs.title",
      descriptionKey: "home.rows.jobs.description",
    },
    rides: {
      titleKey: "home.rows.rides.title",
      descriptionKey: "home.rows.rides.description",
    },
    nearby_drivers: {
      titleKey: "home.rows.seeDrivers.title",
      descriptionKey: "home.rows.seeDrivers.description",
    },
    nearby_passengers: {
      titleKey: "home.rows.seePassengers.title",
      descriptionKey: "home.rows.seePassengers.description",
    },
    schedule_trip: {
      titleKey: "home.rows.scheduleTrip.title",
      descriptionKey: "home.rows.scheduleTrip.description",
    },
    motor_insurance: {
      titleKey: "home.rows.motorInsurance.title",
      descriptionKey: "home.rows.motorInsurance.description",
    },
    nearby_pharmacies: {
      titleKey: "home.rows.nearbyPharmacies.title",
      descriptionKey: "home.rows.nearbyPharmacies.description",
    },
    quincailleries: {
      titleKey: "home.rows.nearbyQuincailleries.title",
      descriptionKey: "home.rows.nearbyQuincailleries.description",
    },
    shops_services: {
      titleKey: "home.rows.marketplace.title",
      descriptionKey: "home.rows.marketplace.description",
    },
    property_rentals: {
      titleKey: "home.rows.propertyRentals.title",
      descriptionKey: "home.rows.propertyRentals.description",
    },
    momo_qr: {
      titleKey: "home.rows.momoQr.title",
      descriptionKey: "home.rows.momoQr.description",
    },
    bars_restaurants: {
      titleKey: "home.rows.barsRestaurants.title",
      descriptionKey: "home.rows.barsRestaurants.description",
    },
    notary_services: {
      titleKey: "home.rows.notaryServices.title",
      descriptionKey: "home.rows.notaryServices.description",
    },
    profile_assets: {
      titleKey: "home.rows.profile.title",
      descriptionKey: "home.rows.profile.description",
    },
    token_transfer: {
      titleKey: "home.rows.tokenTransfer.title",
      descriptionKey: "home.rows.tokenTransfer.description",
    },
    general_broker: {
      titleKey: "home.rows.generalBroker.title",
      descriptionKey: "home.rows.generalBroker.description",
    },
    customer_support: {
      titleKey: "home.rows.customerSupport.title",
      descriptionKey: "home.rows.customerSupport.description",
    },
  };

  return (
    mapping[key] || {
      titleKey: `home.rows.${key}.title`,
      descriptionKey: `home.rows.${key}.description`,
    }
  );
}
