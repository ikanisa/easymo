/**
 * Handle category selection and location sharing
 * Uses proper state management via chat_state table
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js";

import { logStructuredEvent } from "../_shared/observability.ts";
import { ensureProfile, getState, setState } from "../_shared/wa-webhook-shared/state/store.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";

interface BuySellState {
  selectedCategory: string;
  categoryName: string;
  categoryIcon: string;
  waitingForLocation: boolean;
  latitude?: number;
  longitude?: number;
  offset?: number; // For pagination
  totalAvailable?: number; // Total businesses available
}

export async function handleCategorySelection(
  userPhone: string,
  categoryId: string
): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Get or create user profile
    const profile = await ensureProfile(supabase, userPhone);
    
    // Extract category key from ID (format: "category_pharmacies")
    const categoryKey = categoryId.replace("category_", "");

    // Fetch category details from database
    const { data: category, error: catError } = await supabase
      .from("buy_sell_categories")
      .select("key, name, icon")
      .eq("key", categoryKey)
      .single();

    if (catError || !category) {
      await logStructuredEvent("BUY_SELL_CATEGORY_NOT_FOUND", {
        categoryId,
        categoryKey,
        error: catError?.message,
      });
      await sendText(userPhone, "❌ Category not found. Please try again.");
      return;
    }

    // Store state using chat_state table
    await setState(supabase, profile.user_id, {
      key: "buy_sell_location_request",
      data: {
        selectedCategory: category.key,
        categoryName: category.name,
        categoryIcon: category.icon,
        waitingForLocation: true,
      } as BuySellState,
    });

    await logStructuredEvent("BUY_SELL_CATEGORY_SELECTED", {
      userId: profile.user_id,
      category: category.key,
      categoryName: category.name,
    });

    // Ask for location
    await sendText(
      userPhone,
      `📍 *Finding ${category.icon} ${category.name}*\n\n` +
      `Please share your location so I can find nearby businesses.\n\n` +
      `Tap the 📎 attachment icon → Location → Send your current location`
    );
  } catch (error) {
    await logStructuredEvent("BUY_SELL_CATEGORY_ERROR", {
      error: error instanceof Error ? error.message : String(error),
      categoryId,
    });
    await sendText(userPhone, "❌ Something went wrong. Please try again.");
  }
}

export async function handleLocationShared(
  userPhone: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Get user profile
    const profile = await ensureProfile(supabase, userPhone);
    
    // Load state from chat_state table
    const chatState = await getState(supabase, profile.user_id);
    
    // Check if user is in buy_sell flow
    if (chatState.key !== "buy_sell_location_request" || !chatState.data) {
      await logStructuredEvent("BUY_SELL_NO_STATE", {
        userId: profile.user_id,
        stateKey: chatState.key,
      });
      await sendText(userPhone, "Please select a category first by clicking 🛒 Buy & Sell.");
      return;
    }

    const state = chatState.data as BuySellState;
    
    if (!state.waitingForLocation || !state.selectedCategory) {
      await logStructuredEvent("BUY_SELL_INVALID_STATE", {
        userId: profile.user_id,
        state,
      });
      await sendText(userPhone, "Please select a category first.");
      return;
    }

    await logStructuredEvent("BUY_SELL_LOCATION_RECEIVED", {
      userId: profile.user_id,
      category: state.selectedCategory,
      latitude,
      longitude,
    });

    // Search for nearby businesses (fetch 10 to check if more available)
    const { data: businesses, error } = await supabase.rpc(
      "search_businesses_nearby",
      {
        p_latitude: latitude,
        p_longitude: longitude,
        p_category_key: state.selectedCategory,
        p_radius_km: 10,
        p_limit: 19, // Fetch 19 to show 9 and check if more exist
      }
    );

    if (error) {
      await logStructuredEvent("BUY_SELL_SEARCH_ERROR", {
        userId: profile.user_id,
        error: error.message,
        category: state.selectedCategory,
      });
      await sendText(
        userPhone,
        `❌ Error searching for ${state.categoryName}. Please try again.`
      );
      return;
    }

    if (!businesses || businesses.length === 0) {
      await logStructuredEvent("BUY_SELL_NO_RESULTS", {
        userId: profile.user_id,
        category: state.selectedCategory,
        latitude,
        longitude,
      });
      await sendText(
        userPhone,
        `😔 No ${state.categoryName.toLowerCase()} found within 10km.\n\n` +
        `Try searching in a different area or check back later.`
      );
      // Clear state
      await setState(supabase, profile.user_id, { key: "home", data: {} });
      return;
    }

    // Show first 9 businesses
    const displayBusinesses = businesses.slice(0, 9);
    const hasMore = businesses.length > 9;

    // Format results
    let message = `📍 *Found ${displayBusinesses.length}${hasMore ? '+' : ''} ${state.categoryName}* near you:\n\n`;

    displayBusinesses.forEach((biz: any, index: number) => {
      const distance = biz.distance_km
        ? `${biz.distance_km.toFixed(1)}km away`
        : "Distance unknown";
      
      message += `${index + 1}. *${biz.name}*\n`;
      message += `   📍 ${distance}\n`;
      if (biz.address) message += `   📫 ${biz.address}\n`;
      if (biz.phone) message += `   📞 ${biz.phone}\n`;
      if (biz.owner_whatsapp) message += `   💬 WhatsApp: ${biz.owner_whatsapp}\n`;
      message += `\n`;
    });

    message += `💡 Tap a WhatsApp number to chat directly with the business!`;

    await sendText(userPhone, message);

    // If there are more businesses, store state and send "Show More" button
    if (hasMore) {
      // Update state with location and offset for pagination
      await setState(supabase, profile.user_id, {
        key: "buy_sell_results",
        data: {
          selectedCategory: state.selectedCategory,
          categoryName: state.categoryName,
          categoryIcon: state.categoryIcon,
          waitingForLocation: false,
          latitude,
          longitude,
          offset: 9, // Next page starts at index 9
          totalAvailable: businesses.length,
        } as BuySellState,
      });

      // Send "Show More" button using the WhatsApp client
      const { sendButtons } = await import("../_shared/wa-webhook-shared/wa/client.ts");
      await sendButtons(
        userPhone,
        `💡 Showing ${displayBusinesses.length} of ${businesses.length}+ businesses nearby`,
        [
          { id: "buy_sell_show_more", title: "📋 Show More" },
          { id: "buy_sell_new_search", title: "🔄 New Search" },
        ]
      );

      await logStructuredEvent("BUY_SELL_RESULTS_SENT_WITH_MORE", {
        userId: profile.user_id,
        category: state.selectedCategory,
        resultCount: displayBusinesses.length,
        hasMore: true,
      });
    } else {
      // No more businesses, clear state
      await setState(supabase, profile.user_id, { key: "home", data: {} });

      await logStructuredEvent("BUY_SELL_RESULTS_SENT", {
        userId: profile.user_id,
        category: state.selectedCategory,
        resultCount: displayBusinesses.length,
      });
    }
  } catch (error) {
    await logStructuredEvent("BUY_SELL_LOCATION_ERROR", {
      error: error instanceof Error ? error.message : String(error),
      latitude,
      longitude,
    });
    await sendText(userPhone, "❌ Something went wrong. Please try again.");
  }
}
