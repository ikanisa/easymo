/**
 * Show Buy & Sell categories as interactive list with pagination
 * Categories are fetched from buy_sell_categories table
 * Shows 9 categories per page with "Show More" option
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendList, sendButtons } from "../_shared/wa-webhook-shared/wa/client.ts";
import { ensureProfile, getState, setState } from "../_shared/wa-webhook-shared/state/store.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

interface CategoryMenuState {
  page: number;
  totalCategories: number;
}

export async function showBuySellCategories(
  userPhone: string,
  userCountry: string = "RW",
  page: number = 0
): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Fetch ALL active categories from database
  const { data: categories, error } = await supabase
    .from("buy_sell_categories")
    .select("key, icon, name, country_specific_names, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error || !categories || categories.length === 0) {
    throw new Error("Failed to load categories");
  }

  const ITEMS_PER_PAGE = 9;
  const startIndex = page * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCategories = categories.slice(startIndex, endIndex);
  const hasMore = endIndex < categories.length;
  const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE);

  // Get country-specific names or default
  const rows = paginatedCategories.map(cat => {
    let displayName = cat.name;
    
    // Use country-specific name if available
    if (cat.country_specific_names?.[userCountry]?.name) {
      displayName = cat.country_specific_names[userCountry].name;
    }

    return {
      id: `category_${cat.key}`,
      title: `${cat.icon} ${displayName}`,
      description: `Find nearby ${cat.name.toLowerCase()}`,
    };
  });

  // Show categories list
  const shownCount = startIndex + paginatedCategories.length;
  const headerText = `🛒 *Buy & Sell*\n\nShowing ${shownCount} of ${categories.length} categories\n\nChoose a category to find nearby businesses:`;

  await sendList(userPhone, {
    body: headerText,
    button: "Select Category",
    sections: [
      {
        title: page === 0 ? "Browse Categories" : `Categories (Page ${page + 1}/${totalPages})`,
        rows,
      },
    ],
  });

  // If there are more categories, show "Show More" button
  if (hasMore) {
    // Store pagination state
    const profile = await ensureProfile(supabase, userPhone);
    await setState(supabase, profile.user_id, {
      key: "buy_sell_menu_pagination",
      data: {
        page: page + 1,
        totalCategories: categories.length,
      } as CategoryMenuState,
    });

    await sendButtons(userPhone, {
      body: `💡 Showing ${shownCount} of ${categories.length} categories`,
      buttons: [
        { id: "buy_sell_show_more_categories", title: "📋 See More" },
        { id: "home", title: "🏠 Home" },
      ],
    });

    await logStructuredEvent("BUY_SELL_CATEGORIES_SENT_WITH_MORE", {
      page,
      shown: paginatedCategories.length,
      total: categories.length,
      hasMore: true,
    });
  } else {
    await logStructuredEvent("BUY_SELL_CATEGORIES_SENT", {
      page,
      shown: paginatedCategories.length,
      total: categories.length,
    });
  }
}

/**
 * Handle "Show More" button for category pagination
 */
export async function handleShowMoreCategories(userPhone: string): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const profile = await ensureProfile(supabase, userPhone);
    const chatState = await getState(supabase, profile.user_id);

    // Verify user is in correct state
    if (chatState.key !== "buy_sell_menu_pagination" || !chatState.data) {
      await showBuySellCategories(userPhone, "RW", 0);
      return;
    }

    const state = chatState.data as CategoryMenuState;
    const nextPage = state.page || 0;

    await logStructuredEvent("BUY_SELL_SHOW_MORE_CATEGORIES_REQUESTED", {
      userId: profile.user_id,
      page: nextPage,
    });

    // Show next page
    await showBuySellCategories(userPhone, "RW", nextPage);

  } catch (error) {
    await logStructuredEvent("BUY_SELL_SHOW_MORE_CATEGORIES_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Fallback to first page
    await showBuySellCategories(userPhone, "RW", 0);
  }
}
