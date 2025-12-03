// Real Estate AI Agent Integration for Property Rentals
import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { t } from "../../_shared/wa-webhook-shared/i18n/translator.ts";
import { sendMessage, sendButtonsMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { setState, getState } from "../../_shared/wa-webhook-shared/state/store.ts";

interface PropertySearchState {
  sessionId?: string;
  rentalType: "short_term" | "long_term";
  bedrooms?: number;
  maxBudget?: number;
  location?: { latitude: number; longitude: number };
  status: "awaiting_criteria" | "searching" | "results_ready";
}

/**
 * Start property search with AI Agent
 */
export async function startPropertyAISearch(
  ctx: RouterContext,
  rentalType: "short_term" | "long_term"
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    await logStructuredEvent("PROPERTY_AI_SEARCH_START", {
      userId: ctx.profileId,
      rentalType
    });

    // Check if we already have a location (cache or saved)
    const { resolvePropertyLocation } = await import("../handlers/location-handler.ts");
    const locationResult = await resolvePropertyLocation(ctx);

    if (locationResult.location) {
      // We have a location! Save it to state and proceed
      await setState(ctx.supabase, ctx.profileId, {
        key: "property_ai_search",
        data: {
          rentalType,
          status: "awaiting_criteria",
          location: {
            latitude: locationResult.location.lat,
            longitude: locationResult.location.lng
          }
        } as PropertySearchState
      });

      const { formatLocationContext } = await import("../handlers/location-handler.ts");
      const locationContext = formatLocationContext(locationResult.location);

      await sendMessage(ctx, {
        text: `🏠 *AI Property Search - ${rentalType === "short_term" ? "Short-term" : "Long-term"} Rental*\n\n` +
              `${locationContext}\n\n` +
              `Great! Now please provide:\n` +
              `1. Number of bedrooms (e.g., "2 bedrooms")\n` +
              `2. Your maximum budget in RWF (e.g., "500000")\n\n` +
              `_Type your criteria and I'll search for properties nearby._`
      });
    } else {
      // No location - ask for criteria first, then location
      await setState(ctx.supabase, ctx.profileId, {
        key: "property_ai_search",
        data: {
          rentalType,
          status: "awaiting_criteria"
        } as PropertySearchState
      });

      await sendMessage(ctx, {
        text: `🏠 *AI Property Search - ${rentalType === "short_term" ? "Short-term" : "Long-term"} Rental*\n\n` +
              `Let me help you find the perfect property!\n\n` +
              `Please provide:\n` +
              `1. Number of bedrooms (e.g., "2 bedrooms")\n` +
              `2. Your maximum budget in RWF (e.g., "500000")\n` +
              `3. Share your location when prompted (use WhatsApp Location map pin)\n\n` +
              `_Type your criteria, then send your location via WhatsApp Location (map pin)_`
      });
    }

    return true;

  } catch (error) {
    await logStructuredEvent("PROPERTY_AI_SEARCH_ERROR", {
      error: error.message,
      userId: ctx.profileId
    });

    await sendMessage(ctx, {
      text: t(ctx.locale, "errors.generic")
    });

    return false;
  }
}

/**
 * Handle property search criteria input
 */
export async function handlePropertySearchCriteria(
  ctx: RouterContext,
  input: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    const state = await getState<PropertySearchState>(
      ctx.supabase,
      ctx.profileId,
      "property_ai_search"
    );

    if (!state?.data) return false;

    // Extract bedrooms and budget from input
    const bedroomsMatch = input.match(/(\d+)\s*(bedroom|br|bed)/i);
    const budgetMatch = input.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);

    const updatedState = { ...state.data };

    if (bedroomsMatch) {
      updatedState.bedrooms = parseInt(bedroomsMatch[1]);
    }

    if (budgetMatch) {
      updatedState.maxBudget = parseFloat(budgetMatch[1].replace(/,/g, ""));
    }

    await setState(ctx.supabase, ctx.profileId, {
      key: "property_ai_search",
      data: updatedState
    });

    // Check if we have all criteria
    if (updatedState.bedrooms && updatedState.maxBudget) {
      await sendMessage(ctx, {
        text: `✅ *Search Criteria Set*\n\n` +
              `🛏️ Bedrooms: ${updatedState.bedrooms}\n` +
              `💰 Max Budget: ${updatedState.maxBudget.toLocaleString()} RWF\n\n` +
              `📍 Please share your location to find nearby properties.`
      });
    } else {
      const missing = [];
      if (!updatedState.bedrooms) missing.push("bedrooms");
      if (!updatedState.maxBudget) missing.push("budget");

      await sendMessage(ctx, {
        text: `Still need: ${missing.join(", ")}\n\n` +
              `Please provide the missing information.`
      });
    }

    return true;

  } catch (error) {
    await logStructuredEvent("PROPERTY_CRITERIA_ERROR", {
      error: error.message,
      userId: ctx.profileId
    });

    return false;
  }
}

/**
 * Execute property search with location
 */
export async function executePropertyAISearch(
  ctx: RouterContext,
  latitude: number,
  longitude: number
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    const state = await getState<PropertySearchState>(
      ctx.supabase,
      ctx.profileId,
      "property_ai_search"
    );

    if (!state?.data) {
      await sendMessage(ctx, {
        text: "❌ No active property search. Please start a new search from the menu."
      });
      return false;
    }

    if (!state.data.bedrooms || !state.data.maxBudget) {
      await sendMessage(ctx, {
        text: "❌ Missing search criteria. Please provide bedrooms and budget first."
      });
      return false;
    }

    // Save location to cache for future use
    const { cachePropertyLocation } = await import("../handlers/location-handler.ts");
    await cachePropertyLocation(ctx, latitude, longitude);

    await sendMessage(ctx, {
      text: "🔍 *Searching Properties...*\n\nOur AI agent is searching for properties that match your criteria. This may take a moment..."
    });

    await logStructuredEvent("PROPERTY_AI_SEARCH_EXECUTE", {
      userId: ctx.profileId,
      bedrooms: state.data.bedrooms,
      maxBudget: state.data.maxBudget,
      rentalType: state.data.rentalType,
      lat: latitude,
      lng: longitude
    });

    // Call property-rental agent
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-property-rental`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          userId: ctx.profileId,
          action: "find",
          rentalType: state.data.rentalType,
          bedrooms: state.data.bedrooms,
          maxBudget: state.data.maxBudget,
          location: { latitude, longitude }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Property AI failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success) {
      // Send results
      await sendMessage(ctx, {
        text: data.message
      });

      // Update state with session ID
      await setState(ctx.supabase, ctx.profileId, {
        key: "property_ai_search",
        data: {
          ...state.data,
          sessionId: data.searchId,
          status: "results_ready"
        }
      });

      await logStructuredEvent("PROPERTY_AI_SEARCH_SUCCESS", {
        userId: ctx.profileId,
        sessionId: data.searchId,
        optionsCount: data.options?.length || 0
      });

    } else {
      await sendMessage(ctx, {
        text: data.message || "No properties found. Try adjusting your search criteria."
      });
    }

    return true;

  } catch (error) {
    await logStructuredEvent("PROPERTY_AI_SEARCH_EXECUTE_ERROR", {
      error: error.message,
      userId: ctx.profileId
    });

    await sendMessage(ctx, {
      text: t(ctx.locale, "errors.generic")
    });

    return false;
  }
}

/**
 * Add property listing via AI Agent
 */
export async function addPropertyViaAI(
  ctx: RouterContext,
  rentalType: "short_term" | "long_term"
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    await logStructuredEvent("PROPERTY_AI_ADD_START", {
      userId: ctx.profileId,
      rentalType
    });

    await sendMessage(ctx, {
      text: `🏠 *List Your Property - ${rentalType === "short_term" ? "Short-term" : "Long-term"} Rental*\n\n` +
            `Please provide:\n` +
            `1. Number of bedrooms (e.g., "3 bedrooms")\n` +
            `2. Monthly rent in RWF (e.g., "600000")\n` +
            `3. Property address\n` +
            `4. Share location when prompted\n\n` +
            `_Type your property details to continue_`
    });

    await setState(ctx.supabase, ctx.profileId, {
      key: "property_ai_add",
      data: {
        rentalType,
        status: "awaiting_details"
      }
    });

    return true;

  } catch (error) {
    await logStructuredEvent("PROPERTY_AI_ADD_ERROR", {
      error: error.message,
      userId: ctx.profileId
    });

    return false;
  }
}

/**
 * Clear property search state
 */
export async function clearPropertySearchState(
  ctx: RouterContext
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_ai_search",
    data: null
  });

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_ai_add",
    data: null
  });

  return true;
}

/**
 * Check if user has active property search
 */
export async function hasActivePropertySearch(
  ctx: RouterContext
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const state = await getState<PropertySearchState>(
    ctx.supabase,
    ctx.profileId,
    "property_ai_search"
  );

  return state?.data?.status === "awaiting_criteria" || state?.data?.status === "searching";
}
