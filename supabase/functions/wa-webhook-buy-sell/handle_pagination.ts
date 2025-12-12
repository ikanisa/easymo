/**
 * Handle "Show More" pagination for Buy & Sell results
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent } from "../_shared/observability.ts";
import { ensureProfile, getState, setState } from "../_shared/wa-webhook-shared/state/store.ts";
import { sendText, sendButtons } from "../_shared/wa-webhook-shared/wa/client.ts";

interface BuySellState {
  selectedCategory: string;
  categoryName: string;
  categoryIcon: string;
  waitingForLocation: boolean;
  latitude?: number;
  longitude?: number;
  offset?: number;
  totalAvailable?: number;
}

export async function handleShowMore(userPhone: string): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const profile = await ensureProfile(supabase, userPhone);
    const chatState = await getState(supabase, profile.user_id);

    // Verify user is in correct state
    if (chatState.key !== "buy_sell_results" || !chatState.data) {
      await sendText(userPhone, "⚠️ No search results available. Please start a new search.");
      return;
    }

    const state = chatState.data as BuySellState;

    if (!state.latitude || !state.longitude || !state.selectedCategory) {
      await sendText(userPhone, "⚠️ Search expired. Please start a new search.");
      await setState(supabase, profile.user_id, { key: "home", data: {} });
      return;
    }

    const currentOffset = state.offset || 0;

    await logStructuredEvent("BUY_SELL_SHOW_MORE_REQUESTED", {
      userId: profile.user_id,
      category: state.selectedCategory,
      offset: currentOffset,
    });

    // Fetch next batch of businesses (fetch extra to check if more exist)
    const { data: businesses, error } = await supabase.rpc(
      "search_businesses_nearby",
      {
        p_latitude: state.latitude,
        p_longitude: state.longitude,
        p_category_key: state.selectedCategory,
        p_radius_km: 10,
        p_limit: currentOffset + 19, // Fetch up to current offset + 19
      }
    );

    if (error) {
      await logStructuredEvent("BUY_SELL_SHOW_MORE_ERROR", {
        userId: profile.user_id,
        error: error.message,
      });
      await sendText(userPhone, "❌ Error loading more results. Please try again.");
      return;
    }

    if (!businesses || businesses.length <= currentOffset) {
      await sendText(userPhone, "✅ You've seen all available businesses in this area!");
      await setState(supabase, profile.user_id, { key: "home", data: {} });
      return;
    }

    // Get next 9 businesses
    const nextBusinesses = businesses.slice(currentOffset, currentOffset + 9);
    const hasMore = businesses.length > (currentOffset + 9);

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
        key: "buy_sell_results",
        data: {
          ...state,
          offset: currentOffset + 9,
        } as BuySellState,
      });

      const shown = currentOffset + nextBusinesses.length;
      await sendButtons(
        userPhone,
        `💡 Showing ${shown} of ${businesses.length}+ businesses`,
        [
          { id: "buy_sell_show_more", title: "📋 Show More" },
          { id: "buy_sell_new_search", title: "🔄 New Search" },
        ]
      );

      await logStructuredEvent("BUY_SELL_MORE_RESULTS_SENT", {
        userId: profile.user_id,
        category: state.selectedCategory,
        resultCount: nextBusinesses.length,
        offset: currentOffset + 9,
        hasMore: true,
      });
    } else {
      // No more businesses
      await setState(supabase, profile.user_id, { key: "home", data: {} });

      await sendText(
        userPhone,
        `✅ That's all ${businesses.length} businesses in this area!`
      );

      await logStructuredEvent("BUY_SELL_ALL_RESULTS_SHOWN", {
        userId: profile.user_id,
        category: state.selectedCategory,
        totalShown: businesses.length,
      });
    }
  } catch (error) {
    await logStructuredEvent("BUY_SELL_SHOW_MORE_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendText(userPhone, "❌ Something went wrong. Please start a new search.");
  }
}

export async function handleNewSearch(userPhone: string): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const profile = await ensureProfile(supabase, userPhone);
    
    // Clear state
    await setState(supabase, profile.user_id, { key: "home", data: {} });

    await logStructuredEvent("BUY_SELL_NEW_SEARCH_REQUESTED", {
      userId: profile.user_id,
    });

    // Show categories list immediately instead of asking user to select from menu
    const { showBuySellCategories } = await import("./show_categories.ts");
    const { getCountryCode } = await import("../_shared/phone-utils.ts");
    
    // Map country code to format expected by categories
    const countryCode = getCountryCode(userPhone);
    const userCountry = mapCountry(countryCode);
    
    await showBuySellCategories(userPhone, userCountry);
  } catch (error) {
    await logStructuredEvent("BUY_SELL_NEW_SEARCH_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Map country code to expected format
function mapCountry(countryCode: string | null): string {
  if (!countryCode) return "RW";
  const code = countryCode.toUpperCase();
  if (["RW", "BI", "CD", "TZ", "MT"].includes(code)) return code;
  return "RW"; // Default to Rwanda
}
