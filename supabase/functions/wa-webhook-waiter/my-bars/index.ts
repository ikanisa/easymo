import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { sendListMessage, sendButtonsMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export const BARS_HOME_STATE = "bars_home";
export const BAR_DETAIL_STATE = "bar_detail";

interface BarBusiness {
  id: string;
  name: string;
  category_name: string | null;
  bar_id: string | null;
}

interface RouterContext {
  supabase: SupabaseClient;
  from: string;
  profileId: string | null;
  locale: string;
}

/**
 * Show user's bar and restaurant businesses
import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { sendListMessage, sendButtonsMessage, buildButtons } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { t } from "../../_shared/wa-webhook-shared/i18n/translator.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export const BAR_MANAGEMENT_STATE = "bar_management";

/**
 * Show user's bars and restaurants
 */
export async function showMyBarsRestaurants(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  const barCategories = ['bar', 'restaurant', 'bar_restaurant', 'bar & restaurant', 'cafe', 'pub', 'lounge'];
  
  const { data: businesses, error } = await ctx.supabase
    .from("business")
    .select("id, name, category_name, bar_id, location_text")
    .or(`owner_user_id.eq.${ctx.profileId},owner_whatsapp.eq.${ctx.from}`)
    .eq("is_active", true);

  if (error) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to load your bars & restaurants.",
      [{ id: IDS.BACK_PROFILE, title: "← Back" }]
  await logStructuredEvent("BAR_MANAGEMENT_VIEWED", {
    userId: ctx.profileId,
  });

  // Get user's bar/restaurant businesses
  const { data: businesses, error } = await ctx.supabase
    .from("business")
    .select("id, name, category_name, location_text, bar_id")
    .eq("owner_user_id", ctx.profileId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !businesses || businesses.length === 0) {
    await sendButtonsMessage(
      ctx,
      "🍽️ *No bars or restaurants found*\n\n" +
      "You don't have any bar or restaurant businesses yet.",
      buildButtons(
        { id: IDS.MY_BUSINESSES, title: "View All Businesses" },
        { id: IDS.BACK_MENU, title: "Back" },
      ),
    );
    return true;
  }

  const barBusinesses = (businesses || []).filter((biz) => {
    const cat = `${biz.category_name ?? ""}`.toLowerCase();
    return barCategories.some(bc => cat.includes(bc));
  });

  if (barBusinesses.length === 0) {
    await sendButtonsMessage(
      ctx,
      "🍽️ *My Bars & Restaurants*\n\nYou don't have any bars or restaurants yet.\n\nAdd a business with a bar/restaurant category to manage menus, orders, and payments.",
      [
        { id: IDS.BUSINESS_ADD_MANUAL, title: "➕ Add Business" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ]
  // Filter only bar/restaurant businesses
  const barRestaurants = businesses.filter((b) => {
    const cat = (b.category_name || "").toLowerCase();
    return cat.includes("bar") || cat.includes("restaurant") || 
           cat.includes("pub") || cat.includes("cafe") || cat.includes("bistro");
  });

  if (barRestaurants.length === 0) {
    await sendButtonsMessage(
      ctx,
      "🍽️ *No bars or restaurants found*\n\n" +
      "None of your businesses are bars or restaurants.",
      buildButtons(
        { id: IDS.MY_BUSINESSES, title: "View All Businesses" },
        { id: IDS.BACK_MENU, title: "Back" },
      ),
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: BARS_HOME_STATE,
    data: { businesses: barBusinesses.map(b => b.id) },
  });

  const rows = barBusinesses.map((biz) => ({
    id: `bar::${biz.id}`,
    title: biz.name.slice(0, 24),
    description: `${biz.category_name || "Restaurant"} • Manage menu & orders`,
  }));

  rows.push({
    id: IDS.BACK_PROFILE,
    title: "← Back to Profile",
    description: "Return to profile menu",
  });

  await sendListMessage(ctx, {
    title: "🍽️ My Bars & Restaurants",
    body: `You have ${barBusinesses.length} bar/restaurant(s). Select one to manage:`,
    sectionTitle: "Venues",
    buttonText: "Select",
    rows,
  });
  const rows = barRestaurants.map((bar) => ({
    id: `bar::${bar.id}`,
    title: bar.name.substring(0, 24),
    description: `${bar.category_name || "Bar/Restaurant"} • ${bar.location_text || "No location"}`,
  }));

  rows.push({
    id: IDS.BACK_MENU,
    title: "← Back",
    description: "Return to profile",
  });

  await sendListMessage(
    ctx,
    {
      title: "🍽️ My Bars & Restaurants",
      body: `You have ${barRestaurants.length} bar(s)/restaurant(s).\n\nSelect one to manage menu and orders.`,
      sectionTitle: "Your Venues",
      rows,
      buttonText: "Select",
    },
    { emoji: "🍽️" },
  );

  return true;
}

/**
 * Show management options for a specific bar/restaurant
 */
export async function showBarManagement(
  ctx: RouterContext,
  businessId: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: business, error } = await ctx.supabase
    .from("business")
    .select("id, name, category_name, bar_id")
    .eq("id", businessId)
  businessId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Get bar details
  const { data: business, error } = await ctx.supabase
    .from("business")
    .select("id, name, bar_id, category_name")
    .eq("id", businessId)
    .eq("owner_user_id", ctx.profileId)
    .single();

  if (error || !business) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Business not found.",
      [{ id: IDS.MY_BARS_RESTAURANTS, title: "← Back" }]
      "⚠️ Bar/restaurant not found.",
      buildButtons({ id: IDS.MY_BARS_RESTAURANTS, title: "Back" }),
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: BAR_DETAIL_STATE,
    data: { businessId, businessName: business.name, barId: business.bar_id },
  });

  const { count: menuCount } = await ctx.supabase
    .from("restaurant_menu_items")
    .select("id", { count: "exact", head: true })
    .eq("bar_id", business.bar_id || businessId);

  const { count: orderCount } = await ctx.supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .in("status", ["pending", "preparing", "ready"]);

  const rows = [
    {
      id: IDS.BAR_UPLOAD_MENU,
      title: "📸 Upload Menu",
      description: "Upload image/PDF, AI extracts items",
    },
    {
      id: IDS.BAR_MANAGE_MENU,
      title: `📋 Manage Menu (${menuCount || 0} items)`,
      description: "Edit, add, remove menu items",
    },
    {
      id: IDS.BAR_VIEW_ORDERS,
      title: `📦 View Orders (${orderCount || 0} active)`,
      description: "See and manage customer orders",
    },
    {
      id: IDS.BUSINESS_EDIT,
      title: "✏️ Edit Details",
      description: "Update name, location, WhatsApp",
    },
    {
      id: IDS.MY_BARS_RESTAURANTS,
      title: "← Back to Venues",
      description: "Return to venue list",
    },
  ];

  await sendListMessage(ctx, {
    title: `🍽️ ${business.name}`,
    body: `Manage your bar/restaurant:\n\n📋 ${menuCount || 0} menu items\n📦 ${orderCount || 0} active orders`,
    sectionTitle: "Management",
    buttonText: "Select",
    rows,
  });
    key: BAR_MANAGEMENT_STATE,
    data: {
      businessId: business.id,
      businessName: business.name,
      barId: business.bar_id,
    },
  });

  const rows = [
    {
      id: IDS.BAR_MANAGE_MENU,
      title: "📋 Manage Menu",
      description: "Add, edit, or remove menu items",
    },
    {
      id: IDS.BAR_UPLOAD_MENU,
      title: "📸 Upload Menu",
      description: "Scan menu from photo or PDF",
    },
    {
      id: IDS.BAR_VIEW_ORDERS,
      title: "🛒 View Orders",
      description: "See active and past orders",
    },
    {
      id: IDS.MY_BARS_RESTAURANTS,
      title: "← Back",
      description: "Back to my bars & restaurants",
    },
  ];

  await sendListMessage(
    ctx,
    {
      title: `🍽️ ${business.name}`,
      body: "Manage your bar/restaurant menu, orders, and more.",
      sectionTitle: "Management Options",
      rows,
      buttonText: "Select",
    },
    { emoji: "🍽️" },
  );

  return true;
}
