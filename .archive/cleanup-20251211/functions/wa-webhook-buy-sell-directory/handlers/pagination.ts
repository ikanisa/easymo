/**
 * Directory Pagination Handler
 * 
 * Handle "Show More" pagination for business results
 * 
 * State Keys:
 * - directory_results: User viewing results, pagination state
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { ensureProfile, getState, setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendText, sendButtons } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { getCountryCode, mapCountryCode } from "../../_shared/phone-utils.ts";

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
/** Extra results to fetch for checking if more exist */
const PAGINATION_BUFFER = 10;

/**
 * Handle "Show More" button for business results pagination
 */
export async function handleShowMore(userPhone: string): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const profile = await ensureProfile(supabase, userPhone);
    const chatState = await getState(supabase, profile.user_id);

    // Verify user is in correct state
    if (chatState.key !== "directory_results" || !chatState.data) {
      await sendText(userPhone, "⚠️ No search results available. Please start a new search.");
      return;
    }

    const state = chatState.data as DirectoryState;

    if (!state.latitude || !state.longitude || !state.selectedCategory) {
      await sendText(userPhone, "⚠️ Search expired. Please start a new search.");
      await setState(supabase, profile.user_id, { key: "home", data: {} });
      return;
    }

    const currentOffset = state.offset || 0;

    await logStructuredEvent("DIRECTORY_SHOW_MORE", {
      userId: profile.user_id,
      category: state.selectedCategory,
      offset: currentOffset,
    });

    // Fetch next batch of businesses
    const { data: businesses, error } = await supabase.rpc(
      "search_businesses_nearby",
      {
        p_latitude: state.latitude,
        p_longitude: state.longitude,
        p_category_key: state.selectedCategory,
        p_radius_km: SEARCH_RADIUS_KM,
        p_limit: currentOffset + RESULTS_PER_PAGE + PAGINATION_BUFFER,
      }
    );

    if (error) {
      await logStructuredEvent("DIRECTORY_SHOW_MORE_ERROR", {
        userId: profile.user_id,
        error: error.message,
      }, "error");
      await sendText(userPhone, "❌ Error loading more results. Please try again.");
      return;
    }

    if (!businesses || businesses.length <= currentOffset) {
      await sendText(userPhone, "✅ You've seen all available businesses in this area!");
      await setState(supabase, profile.user_id, { key: "home", data: {} });
      return;
    }

    // Get next page of businesses
    const nextBusinesses = businesses.slice(currentOffset, currentOffset + RESULTS_PER_PAGE);
    const hasMore = businesses.length > (currentOffset + RESULTS_PER_PAGE);

    // Format results
    let message = `📍 *More ${state.categoryName}* near you:\n\n`;

    nextBusinesses.forEach((biz: any, index: number) => {
      const distance = biz.distance_km
        ? `${biz.distance_km.toFixed(1)}km away`
        : "Distance unknown";
      
      const displayNumber = currentOffset + index + 1;
      message += `${displayNumber}. *${biz.name}*\n`;
      message += `   📍 ${distance}\n`;
      if (biz.address) message += `   📫 ${biz.address}\n`;
      if (biz.phone) message += `   📞 ${biz.phone}\n`;
      if (biz.owner_whatsapp) message += `   💬 WhatsApp: ${biz.owner_whatsapp}\n`;
      message += `\n`;
    });

    message += `💡 Tap a WhatsApp number to chat directly!`;

    await sendText(userPhone, message);

    // If there are more businesses, update state and send button again
    if (hasMore) {
      await setState(supabase, profile.user_id, {
        key: "directory_results",
        data: {
          ...state,
          offset: currentOffset + RESULTS_PER_PAGE,
        } as DirectoryState,
      });

      const shown = currentOffset + nextBusinesses.length;
      await sendButtons(
        userPhone,
        `💡 Showing ${shown} of ${businesses.length}+ businesses`,
        [
          { id: "directory_show_more", title: "📋 Show More" },
          { id: "directory_new_search", title: "🔄 New Search" },
        ]
      );

      await logStructuredEvent("DIRECTORY_MORE_RESULTS_SENT", {
        userId: profile.user_id,
        category: state.selectedCategory,
        resultCount: nextBusinesses.length,
        offset: currentOffset + RESULTS_PER_PAGE,
        hasMore: true,
      });
    } else {
      // No more businesses
      await setState(supabase, profile.user_id, { key: "home", data: {} });

      await sendText(
        userPhone,
        `✅ That's all ${businesses.length} businesses in this area!`
      );

      await logStructuredEvent("DIRECTORY_ALL_RESULTS_SHOWN", {
        userId: profile.user_id,
        category: state.selectedCategory,
        totalShown: businesses.length,
      });
    }
  } catch (error) {
    await logStructuredEvent("DIRECTORY_SHOW_MORE_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    await sendText(userPhone, "❌ Something went wrong. Please start a new search.");
  }
}

/**
 * Handle "New Search" button - clear state and show categories
 */
export async function handleNewSearch(userPhone: string): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const profile = await ensureProfile(supabase, userPhone);
    
    // Clear state
    await setState(supabase, profile.user_id, { key: "home", data: {} });

    await logStructuredEvent("DIRECTORY_NEW_SEARCH", {
      userId: profile.user_id,
    });

    // Show categories list
    const { showDirectoryCategories } = await import("./categories.ts");
    
    const countryCode = getCountryCode(userPhone);
    const userCountry = mapCountryCode(countryCode);
    
    await showDirectoryCategories(userPhone, userCountry);
  } catch (error) {
    await logStructuredEvent("DIRECTORY_NEW_SEARCH_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    }, "error");
  }
}
