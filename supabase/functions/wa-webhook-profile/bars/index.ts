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
      "⚠️ Bar/restaurant not found.",
      buildButtons({ id: IDS.MY_BARS_RESTAURANTS, title: "Back" }),
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
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
