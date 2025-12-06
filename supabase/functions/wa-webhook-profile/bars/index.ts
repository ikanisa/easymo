import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    .single();

  if (error || !business) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Business not found.",
      [{ id: IDS.MY_BARS_RESTAURANTS, title: "← Back" }]
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

  return true;
}
