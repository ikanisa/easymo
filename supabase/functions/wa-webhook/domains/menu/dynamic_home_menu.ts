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
  | "jobs"
  | "jobs_gigs"
  | "rides"
  | "nearby_drivers"
  | "nearby_passengers"
  | "schedule_trip"
  | "motor_insurance"
  | "insurance_agent"
  | "nearby_pharmacies"
  | "quincailleries"
  | "shops_services"
  | "property_rentals"
  | "momo_qr"
  | "bars_restaurants"
  | "notary_services"
  | "farmer_agent"
  | "profile"
  | "profile_assets"
  | "token_transfer"
  | "general_broker"
  | "customer_support";

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
 * Map menu item keys to IDS constants
 */
export function getMenuItemId(key: MenuItemKey): string {
  const mapping: Record<MenuItemKey, string> = {
    jobs: "job_board",
    jobs_gigs: "job_board",
    rides: "rides_menu",
    nearby_drivers: "see_drivers",
    nearby_passengers: "see_passengers",
    schedule_trip: "schedule_trip",
    motor_insurance: "motor_insurance",
    insurance_agent: "motor_insurance",
    nearby_pharmacies: "nearby_pharmacies",
    quincailleries: "nearby_quincailleries",
    shops_services: "shops_services_menu",
    property_rentals: "property_rentals",
    momo_qr: "momoqr_start",
    bars_restaurants: "bars_restaurants",
    notary_services: "notary_services",
    farmer_agent: "farmer_agent",
    profile: "profile",
    profile_assets: "profile",
    token_transfer: "wallet_transfer",
    general_broker: "general_broker",
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
    insurance_agent: {
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
    farmer_agent: {
      titleKey: "home.rows.farmerAgent.title",
      descriptionKey: "home.rows.farmerAgent.description",
    },
    profile: {
      titleKey: "home.rows.profile.title",
      descriptionKey: "home.rows.profile.description",
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
