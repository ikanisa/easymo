/**
 * Buy & Sell Category Workflow
 * Hybrid approach: structured workflow + AI chat
 */

import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendListMessage, sendButtonsMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { setState, getState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

type BuySellState = {
  key: string;
  data?: {
    category?: string;
    location?: { lat: number; lng: number };
    businesses?: Array<{
      id: string;
      name: string;
      category: string;
      distance_km?: number;
      address?: string;
      phone?: string;
    }>;
  };
};

/**
 * Start Buy & Sell workflow - show top 9 categories
 */
export async function startBuySellWorkflow(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    // Fetch top 9 categories from database
    const { data: categories, error } = await ctx.supabase
      .from("buy_sell_categories")
      .select("key, name, icon, country_specific_names")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(9);

    if (error) {
      await logStructuredEvent("BUY_SELL_CATEGORY_FETCH_ERROR", { error: error.message });
      throw error;
    }

    // Get user's country from phone number
    const userCountry = getCountryFromPhone(ctx.from);

    // Build category list with localized names
    const rows = (categories || []).map(cat => {
      const localizedName = getLocalizedCategoryName(cat, userCountry);
      return {
        id: `category::${cat.key}`,
        title: `${cat.icon} ${localizedName}`,
        description: `Find nearby ${localizedName.toLowerCase()}`
      };
    });

    // Add "Chat with AI" and "Back" options
    rows.push({
      id: "buy_sell_chat_ai",
      title: "💬 Chat with AI Agent",
      description: "Ask me anything about products or services"
    });

    rows.push({
      id: "back_home",
      title: "← Back to Menu",
      description: "Return to main menu"
    });

    // Set state
    await setState(ctx.supabase, ctx.profileId, {
      key: "buy_sell_category_selection",
      data: {}
    });

    // Send category list
    await sendListMessage(
      ctx,
      {
        title: "🛒 Buy & Sell",
        body: "Choose a category to find nearby businesses, or chat with our AI assistant:",
        sectionTitle: "Categories",
        buttonText: "Select",
        rows
      },
      { emoji: "🛒" }
    );

    await logStructuredEvent("BUY_SELL_WORKFLOW_STARTED", { userId: ctx.profileId, country: userCountry });
    return true;

  } catch (error) {
    await logStructuredEvent("BUY_SELL_WORKFLOW_ERROR", { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    await sendButtonsMessage(
      ctx,
      "⚠️ Sorry, couldn't load categories. Please try again.",
      [{ id: "back_home", title: "← Back" }]
    );
    return true;
  }
}

/**
 * Handle category selection - prompt for location
 */
export async function handleCategorySelection(
  ctx: RouterContext,
  categoryKey: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: category } = await ctx.supabase
    .from("buy_sell_categories")
    .select("name, icon")
    .eq("key", categoryKey)
    .eq("is_active", true)
    .maybeSingle();

  if (!category) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Category not found. Please select again.",
      [{ id: "buy_sell_start", title: "← Back to Categories" }]
    );
    return true;
  }

  // Update state with selected category
  await setState(ctx.supabase, ctx.profileId, {
    key: "buy_sell_awaiting_location",
    data: { category: categoryKey }
  });

  // Request location
  await sendButtonsMessage(
    ctx,
    `${category.icon} *${category.name}*\n\n` +
    `📍 Please share your location to find nearby ${category.name.toLowerCase()}.\n\n` +
    `Tap the 📎 button → Location → Send your current location.`,
    [
      { id: "buy_sell_skip_location", title: "Skip (use default)" },
      { id: "buy_sell_start", title: "← Change Category" }
    ]
  );

  await logStructuredEvent("BUY_SELL_CATEGORY_SELECTED", { 
    userId: ctx.profileId, 
    category: categoryKey 
  });

  return true;
}

/**
 * Handle location shared - search nearby businesses
 */
export async function handleLocationShared(
  ctx: RouterContext,
  lat: number,
  lng: number,
  state: BuySellState
): Promise<boolean> {
  if (!ctx.profileId || !state.data?.category) return false;

  const category = state.data.category;

  try {
    // Search nearby businesses using PostGIS
    const { data: businesses, error } = await ctx.supabase.rpc(
      "search_businesses_nearby",
      {
        p_lat: lat,
        p_lng: lng,
        p_category: category,
        p_radius_km: 10,
        p_limit: 10
      }
    );

    if (error) {
      throw error;
    }

    if (!businesses || businesses.length === 0) {
      await sendButtonsMessage(
        ctx,
        `📭 No ${category} found within 10km.\n\n` +
        `Try:\n` +
        `• Selecting a different category\n` +
        `• Chatting with our AI assistant for alternatives`,
        [
          { id: "buy_sell_chat_ai", title: "💬 Chat with AI" },
          { id: "buy_sell_start", title: "← Back to Categories" }
        ]
      );
      return true;
    }

    // Build business list
    const rows = businesses.slice(0, 10).map((biz: any) => ({
      id: `business::${biz.id}`,
      title: `${biz.name}`,
      description: `${biz.distance_km.toFixed(1)}km away • ${biz.address || 'Address not available'}`
    }));

    rows.push({
      id: "buy_sell_chat_ai",
      title: "💬 Chat with AI",
      description: "Ask questions about these businesses"
    });

    rows.push({
      id: "buy_sell_start",
      title: "← Back",
      description: "Choose different category"
    });

    // Update state with businesses
    await setState(ctx.supabase, ctx.profileId, {
      key: "buy_sell_business_list",
      data: { category, location: { lat, lng }, businesses }
    });

    // Send business list
    await sendListMessage(
      ctx,
      {
        title: `${category} Near You`,
        body: `Found ${businesses.length} ${category} within 10km:`,
        sectionTitle: "Businesses",
        buttonText: "View",
        rows
      },
      { emoji: "📍" }
    );

    await logStructuredEvent("BUY_SELL_BUSINESSES_FOUND", {
      userId: ctx.profileId,
      category,
      count: businesses.length
    });

    return true;

  } catch (error) {
    await logStructuredEvent("BUY_SELL_SEARCH_ERROR", {
      error: error instanceof Error ? error.message : String(error),
      category
    });

    await sendButtonsMessage(
      ctx,
      "⚠️ Search failed. Please try again or chat with our AI assistant.",
      [
        { id: "buy_sell_chat_ai", title: "💬 Chat with AI" },
        { id: "buy_sell_start", title: "← Try Again" }
      ]
    );

    return true;
  }
}

/**
 * Handle business selection - show details
 */
export async function handleBusinessSelection(
  ctx: RouterContext,
  businessId: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: business, error } = await ctx.supabase
    .from("business_directory")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Business not found.",
      [{ id: "buy_sell_start", title: "← Back" }]
    );
    return true;
  }

  const details = [
    `📍 *${business.name}*`,
    business.address ? `\n📌 ${business.address}` : '',
    business.phone ? `\n📞 ${business.phone}` : '',
    business.hours ? `\n🕐 ${business.hours}` : '',
    business.description ? `\n\n${business.description}` : ''
  ].filter(Boolean).join('');

  const buttons = [];

  if (business.phone) {
    buttons.push({ id: `call::${business.phone}`, title: "📞 Call" });
  }

  if (business.whatsapp) {
    buttons.push({ id: `whatsapp::${business.whatsapp}`, title: "💬 WhatsApp" });
  }

  buttons.push({ id: "buy_sell_chat_ai", title: "🤖 Ask AI" });
  buttons.push({ id: "buy_sell_start", title: "← Back" });

  await sendButtonsMessage(ctx, details, buttons.slice(0, 3)); // WhatsApp max 3 buttons

  await logStructuredEvent("BUY_SELL_BUSINESS_VIEWED", {
    userId: ctx.profileId,
    businessId,
    businessName: business.name
  });

  return true;
}

/**
 * Get country code from E.164 phone number
 */
function getCountryFromPhone(phone: string): string {
  const countryMap: Record<string, string> = {
    "250": "RW",
    "257": "BI",
    "255": "TZ",
    "243": "CD",
    "260": "ZM",
    "228": "TG",
    "356": "MT"
  };

  const cleanPhone = phone.replace(/^\+/, "");
  for (const [prefix, country] of Object.entries(countryMap)) {
    if (cleanPhone.startsWith(prefix)) {
      return country;
    }
  }

  return "RW"; // Default
}

/**
 * Get localized category name
 */
function getLocalizedCategoryName(
  category: { name: string; country_specific_names?: any },
  countryCode: string
): string {
  if (category.country_specific_names && category.country_specific_names[countryCode]) {
    return category.country_specific_names[countryCode].name || category.name;
  }
  return category.name;
}
