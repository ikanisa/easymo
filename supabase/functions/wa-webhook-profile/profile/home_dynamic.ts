import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendListMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export const PROFILE_STATE_HOME = "profile_home";

type ProfileMenuItem = {
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
 * Get user's country code from profile or default to RW
 */
async function getUserCountry(ctx: RouterContext): Promise<string> {
  if (!ctx.profileId) return "RW";
  
  try {
    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("country, metadata")
      .eq("user_id", ctx.profileId)
      .single();
    
    if (error || !data) return "RW";
    
    // Check country field or metadata
    if (data.country) return data.country;
    if (data.metadata && typeof data.metadata === "object") {
      const meta = data.metadata as Record<string, unknown>;
      if (meta.country && typeof meta.country === "string") {
        return meta.country;
      }
    }
  } catch (err) {
    console.error("profile.get_country_error", err);
  }
  
  return "RW"; // Default to Rwanda
}

/**
 * Fetch dynamic profile menu items from database using get_profile_menu_items_v2
 */
async function fetchProfileMenuItems(
  ctx: RouterContext,
  countryCode: string,
  language: string,
): Promise<ProfileMenuItem[]> {
  try {
    const { data, error } = await ctx.supabase.rpc(
      "get_profile_menu_items_v2",
      {
        p_user_id: ctx.profileId || "00000000-0000-0000-0000-000000000000",
        p_country_code: countryCode,
        p_language: language,
      },
    );

    if (error) {
      console.error("profile.fetch_menu_error", error);
      await logStructuredEvent("PROFILE_MENU_FETCH_ERROR", {
        error: error.message,
        country: countryCode,
        language,
      });
      return getFallbackMenuItems();
    }

    if (!data || data.length === 0) {
      console.warn("profile.no_menu_items", { countryCode, language });
      return getFallbackMenuItems();
    }

    return data as ProfileMenuItem[];
  } catch (err) {
    console.error("profile.fetch_menu_exception", err);
    return getFallbackMenuItems();
  }
}

/**
 * Fallback menu items if database fetch fails
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

export async function startProfile(
  ctx: RouterContext,
  _state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: PROFILE_STATE_HOME,
    data: {},
  });

  // Get user's country and language
  const countryCode = await getUserCountry(ctx);
  const language = ctx.locale || "en";

  // Fetch dynamic menu items
  const menuItems = await fetchProfileMenuItems(ctx, countryCode, language);

  // Log menu display for analytics
  await logStructuredEvent("PROFILE_MENU_DISPLAYED", {
    userId: ctx.profileId,
    country: countryCode,
    language,
    itemCount: menuItems.length,
  });

  // Convert to list message format
  const rows = menuItems.map((item) => ({
    id: item.action_target, // The IDS constant value
    title: `${item.icon} ${item.title}`,
    description: item.description,
  }));

  await sendListMessage(
    ctx,
    {
      title: "👤 Profile",
      body: "Manage your account, wallet, businesses, jobs, properties, vehicles and more.",
      sectionTitle: "Profile",
      buttonText: "View",
      rows,
    },
    { emoji: "👤" },
  );

  return true;
}

/**
 * Track menu item click analytics
 */
export async function trackMenuItemClick(
  ctx: RouterContext,
  itemKey: string,
): Promise<void> {
  try {
    const { data } = await ctx.supabase
      .from("profile_menu_items")
      .select("analytics_event_name, track_analytics")
      .eq("item_key", itemKey)
      .eq("enabled", true)
      .single();

    if (data?.track_analytics && data.analytics_event_name) {
      await logStructuredEvent(data.analytics_event_name, {
        userId: ctx.profileId,
        itemKey,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("profile.track_click_error", err);
  }
}
