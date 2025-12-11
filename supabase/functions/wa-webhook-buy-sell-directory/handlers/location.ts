/**
 * Directory Location Handler
 * 
 * Handle category selection and location sharing
 * Uses state management via chat_state table
 * 
 * State Keys:
 * - directory_category: User selected a category, waiting for location
 * - directory_results: User viewing results, for pagination
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { ensureProfile, getState, setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendText, sendButtons } from "../../_shared/wa-webhook-shared/wa/client.ts";

interface DirectoryState {
  selectedCategory: string;
  categoryName: string;
  categoryIcon: string;
  waitingForLocation: boolean;
  latitude?: number;
  longitude?: number;
  offset?: number;
  totalAvailable?: number;
}

const RESULTS_PER_PAGE = 9;
const SEARCH_RADIUS_KM = 10;

/**
 * Handle user selecting a category from the list
 */
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
      await logStructuredEvent("DIRECTORY_CATEGORY_NOT_FOUND", {
        categoryId,
        categoryKey,
        error: catError?.message,
      }, "warn");
      await sendText(userPhone, "❌ Category not found. Please try again.");
      return;
    }

    // Store state - waiting for location
    await setState(supabase, profile.user_id, {
      key: "directory_category",
      data: {
        selectedCategory: category.key,
        categoryName: category.name,
        categoryIcon: category.icon,
        waitingForLocation: true,
      } as DirectoryState,
    });

    await logStructuredEvent("DIRECTORY_CATEGORY_SELECTED", {
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
    await logStructuredEvent("DIRECTORY_CATEGORY_ERROR", {
      error: error instanceof Error ? error.message : String(error),
      categoryId,
    }, "error");
    await sendText(userPhone, "❌ Something went wrong. Please try again.");
  }
}

/**
 * Handle user sharing their location
 */
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
    
    // Check if user is in directory flow
    if (chatState.key !== "directory_category" || !chatState.data) {
      await logStructuredEvent("DIRECTORY_NO_STATE", {
        userId: profile.user_id,
        stateKey: chatState.key,
      }, "warn");
      await sendText(userPhone, "Please select a category first by clicking 🛒 Buy & Sell.");
      return;
    }

    const state = chatState.data as DirectoryState;
    
    if (!state.waitingForLocation || !state.selectedCategory) {
      await logStructuredEvent("DIRECTORY_INVALID_STATE", {
        userId: profile.user_id,
        state,
      }, "warn");
      await sendText(userPhone, "Please select a category first.");
      return;
    }

    await logStructuredEvent("DIRECTORY_LOCATION_RECEIVED", {
      userId: profile.user_id,
      category: state.selectedCategory,
      latitude,
      longitude,
    });

    // Search for nearby businesses (fetch extra to check if more available)
    const { data: businesses, error } = await supabase.rpc(
      "search_businesses_nearby",
      {
        p_latitude: latitude,
        p_longitude: longitude,
        p_category_key: state.selectedCategory,
        p_radius_km: SEARCH_RADIUS_KM,
        p_limit: RESULTS_PER_PAGE + 10, // Fetch extra to check if more exist
      }
    );

    if (error) {
      await logStructuredEvent("DIRECTORY_SEARCH_ERROR", {
        userId: profile.user_id,
        error: error.message,
        category: state.selectedCategory,
      }, "error");
      await sendText(
        userPhone,
        `❌ Error searching for ${state.categoryName}. Please try again.`
      );
      return;
    }

    if (!businesses || businesses.length === 0) {
      await logStructuredEvent("DIRECTORY_NO_RESULTS", {
        userId: profile.user_id,
        category: state.selectedCategory,
        latitude,
        longitude,
      });
      await sendText(
        userPhone,
        `😔 No ${state.categoryName.toLowerCase()} found within ${SEARCH_RADIUS_KM}km.\n\n` +
        `Try searching in a different area or check back later.`
      );
      // Clear state
      await setState(supabase, profile.user_id, { key: "home", data: {} });
      return;
    }

    // Show first page of businesses
    const displayBusinesses = businesses.slice(0, RESULTS_PER_PAGE);
    const hasMore = businesses.length > RESULTS_PER_PAGE;

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

    // If there are more businesses, store state and send pagination buttons
    if (hasMore) {
      // Update state with location and offset for pagination
      await setState(supabase, profile.user_id, {
        key: "directory_results",
        data: {
          selectedCategory: state.selectedCategory,
          categoryName: state.categoryName,
          categoryIcon: state.categoryIcon,
          waitingForLocation: false,
          latitude,
          longitude,
          offset: RESULTS_PER_PAGE,
          totalAvailable: businesses.length,
        } as DirectoryState,
      });

      await sendButtons(
        userPhone,
        `💡 Showing ${displayBusinesses.length} of ${businesses.length}+ businesses nearby`,
        [
          { id: "directory_show_more", title: "📋 Show More" },
          { id: "directory_new_search", title: "🔄 New Search" },
        ]
      );

      await logStructuredEvent("DIRECTORY_RESULTS_WITH_MORE", {
        userId: profile.user_id,
        category: state.selectedCategory,
        resultCount: displayBusinesses.length,
        hasMore: true,
      });
    } else {
      // No more businesses, clear state
      await setState(supabase, profile.user_id, { key: "home", data: {} });

      await logStructuredEvent("DIRECTORY_RESULTS_SENT", {
        userId: profile.user_id,
        category: state.selectedCategory,
        resultCount: displayBusinesses.length,
      });
    }
  } catch (error) {
    await logStructuredEvent("DIRECTORY_LOCATION_ERROR", {
      error: error instanceof Error ? error.message : String(error),
      latitude,
      longitude,
    }, "error");
    await sendText(userPhone, "❌ Something went wrong. Please try again.");
  }
}
