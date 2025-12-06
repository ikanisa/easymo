import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../../_shared/observability.ts";

export interface ProfileMenuItem {
  item_key: string;
  display_order: number;
  icon: string;
  title: string;
  description: string;
  action_type: string;
  action_target: string;
  metadata: Record<string, unknown>;
}

/**
 * Fetch dynamic profile menu items from database with visibility conditions
 */
export async function fetchDynamicProfileMenuItems(
  supabase: SupabaseClient,
  profileId: string | null,
  countryCode: string,
  language: string
): Promise<ProfileMenuItem[]> {
  if (!profileId) return getFallbackMenuItems(language);

  try {
    const { data, error } = await supabase.rpc("get_profile_menu_items_v2", {
      p_user_id: profileId,
      p_country_code: countryCode,
      p_language: language,
    });

    if (error) {
      await logStructuredEvent("PROFILE_MENU_FETCH_ERROR", {
        error: error.message,
        userId: profileId,
        country: countryCode,
      });
      return getFallbackMenuItems(language);
    }

    if (!data || data.length === 0) {
      return getFallbackMenuItems(language);
    }

    return data as ProfileMenuItem[];
  } catch (err) {
    console.error("profile.fetch_menu_exception", err);
    return getFallbackMenuItems(language);
  }
}

/**
 * Check if user has bar/restaurant business
 */
export async function userHasBarRestaurant(
  supabase: SupabaseClient,
  profileId: string,
  fromPhone: string
): Promise<boolean> {
  const barCategories = ['bar', 'restaurant', 'bar_restaurant', 'bar & restaurant', 'cafe', 'pub'];
  
  const { data } = await supabase
    .from("business")
    .select("category_name, tag")
    .or(`owner_user_id.eq.${profileId},owner_whatsapp.eq.${fromPhone}`)
    .eq("is_active", true);

  if (!data || data.length === 0) return false;

  return data.some((biz) => {
    const cat = `${biz.category_name ?? ""} ${biz.tag ?? ""}`.toLowerCase();
    return barCategories.some(bc => cat.includes(bc));
  });
}

function getFallbackMenuItems(language: string): ProfileMenuItem[] {
  const items: ProfileMenuItem[] = [
    {
      item_key: "edit_profile",
      display_order: 10,
      icon: "✏️",
      title: language === "rw" ? "Hindura Umwirondoro" : "Edit Profile",
      description: language === "rw" ? "Hindura izina n'igenamiterere" : "Update name, language & settings",
      action_type: "route",
      action_target: "EDIT_PROFILE",
      metadata: {},
    },
    {
      item_key: "wallet_tokens",
      display_order: 20,
      icon: "💎",
      title: language === "rw" ? "Agasanduku & Tokens" : "Wallet & Tokens",
      description: language === "rw" ? "Reba amafaranga" : "View balance, transfer, redeem",
      action_type: "route",
      action_target: "WALLET_HOME",
      metadata: {},
    },
    {
      item_key: "my_businesses",
      display_order: 30,
      icon: "🏪",
      title: language === "rw" ? "Ubucuruzi Bwanjye" : "My Businesses",
      description: language === "rw" ? "Gucunga ubucuruzi" : "Manage your business listings",
      action_type: "route",
      action_target: "MY_BUSINESSES",
      metadata: {},
    },
    {
      item_key: "settings",
      display_order: 80,
      icon: "⚙️",
      title: language === "rw" ? "Igenamiterere" : "Settings",
      description: language === "rw" ? "Ibanga n'ibindi" : "Privacy, notifications & more",
      action_type: "route",
      action_target: "SETTINGS",
      metadata: {},
    },
  ];
  return items;
}
