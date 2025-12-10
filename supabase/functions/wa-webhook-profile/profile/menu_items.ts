import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export type ProfileMenuItem = {
  item_key: string;
  display_order: number;
  icon: string;
  title: string;
  description: string;
  action_type: string;
  action_target: string;
  metadata: Record<string, unknown>;
};

/**
 * Fetch dynamic profile menu items from database using get_profile_menu_items_v2 RPC
 * This function queries the database and filters menu items based on:
 * - User's country
 * - User's language preference
 * - User's business ownership (shows "My Bars & Restaurants" only for bar/restaurant owners)
 */
export async function fetchDynamicProfileMenuItems(
  ctx: RouterContext,
  countryCode: string,
  language: string,
): Promise<ProfileMenuItem[]> {
  if (!ctx.profileId) {
    console.warn("menu_items.no_profile_id");
    return getFallbackMenuItems();
  }

  try {
    const { data, error } = await ctx.supabase.rpc(
      "get_profile_menu_items_v2",
      {
        p_user_id: ctx.profileId,
        p_country_code: countryCode,
        p_language: language,
      },
    );

    if (error) {
      console.error("menu_items.fetch_error", error);
      await logStructuredEvent("PROFILE_MENU_FETCH_ERROR", {
        error: error.message,
        country: countryCode,
        language,
        userId: ctx.profileId,
      });
      return getFallbackMenuItems();
    }

    if (!data || data.length === 0) {
      console.warn("menu_items.no_data", { countryCode, language });
      return getFallbackMenuItems();
    }

    // Log successful fetch for analytics
    await logStructuredEvent("PROFILE_MENU_FETCHED", {
      userId: ctx.profileId,
      country: countryCode,
      language,
      itemCount: data.length,
      hasBarRestaurant: data[0]?.metadata?.has_bar_restaurant || false,
    });

    return data as ProfileMenuItem[];
  } catch (err) {
    console.error("menu_items.fetch_exception", err);
    await logStructuredEvent("PROFILE_MENU_FETCH_EXCEPTION", {
      error: err instanceof Error ? err.message : String(err),
      userId: ctx.profileId,
    });
    return getFallbackMenuItems();
  }
}

/**
 * Check if user owns any bar or restaurant businesses
 * Used for conditional menu item visibility
 */
export async function userHasBarRestaurant(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    const { data, error } = await ctx.supabase
      .from("business")
      .select("id, category_name, tag")
      .eq("owner_user_id", ctx.profileId)
      .eq("is_active", true)
      .limit(100);

    if (error || !data || data.length === 0) {
      return false;
    }

    return data.some((business) => {
      const categoryText = `${business.category_name || ""} ${business.tag || ""}`.toLowerCase();
      return (
        categoryText.includes("bar") ||
        categoryText.includes("restaurant") ||
        categoryText.includes("pub") ||
        categoryText.includes("cafe") ||
        categoryText.includes("bistro")
      );
    });
  } catch (err) {
    console.error("menu_items.check_bar_restaurant_error", err);
    return false;
  }
}

/**
 * Fallback menu items if database fetch fails
 * Returns a minimal set of core profile menu options
 */
function getFallbackMenuItems(): ProfileMenuItem[] {
  return [
    {
      item_key: "edit_profile",
      display_order: 1,
      icon: "✏️",
      title: "Edit Profile",
      description: "Update name, language & settings",
      action_type: "route",
      action_target: "EDIT_PROFILE",
      metadata: {},
    },
    {
      item_key: "wallet_tokens",
      display_order: 2,
      icon: "💎",
      title: "Wallet & Tokens",
      description: "View balance, transfer, redeem rewards",
      action_type: "route",
      action_target: "WALLET_HOME",
      metadata: {},
    },
    {
      item_key: "my_businesses",
      display_order: 4,
      icon: "🏪",
      title: "My Businesses",
      description: "Manage your business listings",
      action_type: "route",
      action_target: "MY_BUSINESSES",
      metadata: {},
    },
    {
      item_key: "my_jobs",
      display_order: 5,
      icon: "💼",
      title: "My Jobs",
      description: "Manage your job postings",
      action_type: "route",
      action_target: "MY_JOBS",
      metadata: {},
    },
    {
      item_key: "my_properties",
      display_order: 6,
      icon: "🏠",
      title: "My Properties",
      description: "Manage your property listings",
      action_type: "route",
      action_target: "MY_PROPERTIES",
      metadata: {},
    },
    {
      item_key: "my_vehicles",
      display_order: 7,
      icon: "🚗",
      title: "My Vehicles",
      description: "Manage your registered vehicles",
      action_type: "route",
      action_target: "MY_VEHICLES",
      metadata: {},
    },
    {
      item_key: "saved_locations",
      display_order: 8,
      icon: "📍",
      title: "Saved Locations",
      description: "Your favorite places",
      action_type: "route",
      action_target: "SAVED_LOCATIONS",
      metadata: {},
    },
    {
      item_key: "back_menu",
      display_order: 999,
      icon: "←",
      title: "Back to Menu",
      description: "Return to main menu",
      action_type: "route",
      action_target: "BACK_MENU",
      metadata: {},
    },
  ];
}
