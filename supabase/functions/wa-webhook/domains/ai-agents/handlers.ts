/**
 * AI Agent Handlers for WhatsApp Flows
 *
 * Provides convenient handlers that can be called from the text router
 * to initiate AI agent sessions for various use cases.
 */

import type {
  RouterContext,
  WhatsAppLocationMessage,
  WhatsAppTextMessage,
} from "../../types.ts";
import type { ChatState } from "../../state/store.ts";
import {
  handleAgentSelection,
  routeToAIAgent,
  sendAgentOptions,
} from "./integration.ts";
import { sendText } from "../../wa/client.ts";
import {
  buildButtons,
  homeOnly,
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";
import { t } from "../../i18n/translator.ts";
import { clearState, setState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";
import { listBusinesses } from "../../rpc/marketplace.ts";
import { waChatLink } from "../../utils/links.ts";

const SHOP_RESULT_PREFIX = "SHOP::";

export type ShopResultsState = {
  entries: Array<{ id: string; name: string; whatsapp: string }>;
  prefill?: string | null;
};

/**
 * Handle "Nearby Drivers" request with AI agent
 * DATABASE SEARCH ONLY - No web search
 */
export async function handleAINearbyDrivers(
  ctx: RouterContext,
  vehicleType: string,
  pickup?: { latitude: number; longitude: number; text?: string },
  dropoff?: { latitude: number; longitude: number; text?: string },
): Promise<boolean> {
  try {
    // If locations not provided, ask user
    if (!pickup || !dropoff) {
      await sendText(ctx.from, t(ctx.locale, "driver.provide_locations"));
      await setState(ctx.supabase, ctx.profileId || ctx.from, {
        key: "ai_driver_waiting_locations",
        data: {
          vehicleType,
          pickup,
          dropoff,
        },
      });
      return true;
    }

    await sendText(ctx.from, "🚖 Searching for drivers in our database...");

    const response = await routeToAIAgent(ctx, {
      userId: ctx.from,
      agentType: "nearby_drivers",
      flowType: "find_driver",
      requestData: {
        pickup,
        dropoff,
        vehicleType,
        maxPrice: null,
      },
    });

    if (response.success && response.options && response.options.length > 0) {
      await sendAgentOptions(
        ctx,
        response.sessionId,
        response.options,
        "🚖 Available Drivers",
      );

      await setState(ctx.supabase, ctx.profileId || ctx.from, {
        key: "ai_agent_selection",
        data: {
          sessionId: response.sessionId,
          agentType: "nearby_drivers",
        },
      });
    } else {
      // Send fallback message with helpful info
      await sendButtonsMessage(
        ctx,
        response.message ||
          "🚖 No drivers found at this moment.\n\n" +
            "This could be because:\n" +
            "• No drivers are available in your area\n" +
            "• Try the traditional 'See Drivers' option\n" +
            "• Check back in a few minutes",
        buildButtons(
          { id: IDS.SEE_DRIVERS, title: "👀 See All Drivers" },
          { id: IDS.BACK_HOME, title: "🏠 Home" },
        ),
      );
    }

    return true;
  } catch (error) {
    console.error("AI Nearby Drivers handler error:", error);

    await sendButtonsMessage(
      ctx,
      "😔 Sorry, we encountered an error while searching for drivers.\n\n" +
        "Please try:\n" +
        "• Using the traditional driver search\n" +
        "• Checking your connection\n" +
        "• Trying again in a few minutes\n" +
        "• Contact support if this persists",
      buildButtons(
        { id: IDS.SEE_DRIVERS, title: "👀 See All Drivers" },
        { id: IDS.BACK_HOME, title: "🏠 Home" },
      ),
    );

    return false;
  }
}

/**
 * Handle "Nearby Pharmacies" request with AI agent
 */
export async function handleAINearbyPharmacies(
  ctx: RouterContext,
  location?: { latitude: number; longitude: number; text?: string },
  medications?: string[],
  prescriptionImage?: string,
): Promise<boolean> {
  try {
    if (!location) {
      await sendText(ctx.from, t(ctx.locale, "pharmacy.provide_location"));
      await setState(ctx.supabase, ctx.profileId || ctx.from, {
        key: "ai_pharmacy_waiting_location",
        data: {
          medications,
          prescriptionImage,
        },
      });
      return true;
    }

    await sendText(ctx.from, t(ctx.locale, "agent.searching_pharmacies"));

    const response = await routeToAIAgent(ctx, {
      userId: ctx.from,
      agentType: "pharmacy",
      flowType: "find_medications",
      location,
      requestData: {
        medications,
        prescriptionImage,
      },
    });

    if (response.success && response.options) {
      await sendAgentOptions(
        ctx,
        response.sessionId,
        response.options,
        t(ctx.locale, "pharmacy.options_found"),
      );

      await setState(ctx.supabase, ctx.profileId || ctx.from, {
        key: "ai_agent_selection",
        data: {
          sessionId: response.sessionId,
          agentType: "pharmacy",
        },
      });
    } else {
      await sendText(ctx.from, response.message);
    }

    return true;
  } catch (error) {
    console.error("AI Pharmacy handler error:", error);
    await sendText(ctx.from, t(ctx.locale, "agent.error_occurred"));
    return false;
  }
}

/**
 * Handle "Nearby Quincailleries" request with AI agent
 */
export async function handleAINearbyQuincailleries(
  ctx: RouterContext,
  location?: { latitude: number; longitude: number; text?: string },
  items?: string[],
  itemImage?: string,
): Promise<boolean> {
  try {
    if (!location) {
      await sendText(ctx.from, t(ctx.locale, "quincaillerie.provide_location"));
      await setState(ctx.supabase, ctx.profileId || ctx.from, {
        key: "ai_quincaillerie_waiting_location",
        data: {
          items,
          itemImage,
        },
      });
      return true;
    }

    await sendText(ctx.from, t(ctx.locale, "agent.searching_hardware_stores"));

    const response = await routeToAIAgent(ctx, {
      userId: ctx.from,
      agentType: "quincaillerie",
      flowType: "find_items",
      location,
      requestData: {
        items,
        itemImage,
      },
    });

    if (response.success && response.options) {
      await sendAgentOptions(
        ctx,
        response.sessionId,
        response.options,
        t(ctx.locale, "quincaillerie.options_found"),
      );

      await setState(ctx.supabase, ctx.profileId || ctx.from, {
        key: "ai_agent_selection",
        data: {
          sessionId: response.sessionId,
          agentType: "quincaillerie",
        },
      });
    } else {
      await sendText(ctx.from, response.message);
    }

    return true;
  } catch (error) {
    console.error("AI Quincaillerie handler error:", error);
    await sendText(ctx.from, t(ctx.locale, "agent.error_occurred"));
    return false;
  }
}

/**
 * Handle "Nearby Shops" request with AI agent
 */
export async function handleAINearbyShops(
  ctx: RouterContext,
  location?: { latitude: number; longitude: number; text?: string },
  items?: string[],
  itemImage?: string,
  shopCategory?: string,
): Promise<boolean> {
  try {
    if (!location) {
      await sendText(ctx.from, t(ctx.locale, "shops.provide_location"));
      await setState(ctx.supabase, ctx.profileId || ctx.from, {
        key: "ai_shops_waiting_location",
        data: {
          items,
          itemImage,
          shopCategory,
        },
      });
      return true;
    }

    await sendText(ctx.from, t(ctx.locale, "agent.searching_shops"));

    const response = await routeToAIAgent(ctx, {
      userId: ctx.from,
      agentType: "shops",
      flowType: "find_products",
      location,
      requestData: {
        action: "find",
        items,
        itemImage,
        shopCategory,
      },
    });

    if (response.success && response.options) {
      await sendAgentOptions(
        ctx,
        response.sessionId,
        response.options,
        t(ctx.locale, "shops.options_found"),
      );

      await setState(ctx.supabase, ctx.profileId || ctx.from, {
        key: "ai_agent_selection",
        data: {
          sessionId: response.sessionId,
          agentType: "shops",
        },
      });
      return true;
    }

    if (response.message) {
      await sendText(ctx.from, response.message);
    }
    return await sendShopFallback(ctx, location, items, shopCategory);
  } catch (error) {
    console.error("AI Shops handler error:", error);
    await sendText(ctx.from, t(ctx.locale, "agent.error_occurred"));
    if (location) {
      return await sendShopFallback(ctx, location, items, shopCategory);
    }
    return false;
  }
}

/**
 * Handle "Property Rental" request with AI agent
 */
export async function handleAIPropertyRental(
  ctx: RouterContext,
  action: "find" | "add",
  rentalType: "short_term" | "long_term",
  location?: { latitude: number; longitude: number; text?: string },
  requestData?: any,
): Promise<boolean> {
  try {
    if (!location && action === "find") {
      await sendText(ctx.from, t(ctx.locale, "property.provide_location"));
      await setState(ctx.supabase, ctx.profileId || ctx.from, {
        key: "ai_property_waiting_location",
        data: {
          action,
          rentalType,
          requestData,
        },
      });
      return true;
    }

    const searchingMessage = action === "find"
      ? t(ctx.locale, "agent.searching_properties")
      : t(ctx.locale, "agent.adding_property");

    await sendText(ctx.from, searchingMessage);

    const response = await routeToAIAgent(ctx, {
      userId: ctx.from,
      agentType: "property_rental",
      flowType: action === "add" ? "add_property" : "find_property",
      location,
      requestData: {
        action,
        rentalType,
        ...requestData,
      },
    });

    if (response.success) {
      if (response.options && response.options.length > 0) {
        await sendAgentOptions(
          ctx,
          response.sessionId,
          response.options,
          t(ctx.locale, "property.options_found"),
        );

        await setState(ctx.supabase, ctx.profileId || ctx.from, {
          key: "ai_agent_selection",
          data: {
            sessionId: response.sessionId,
            agentType: "property_rental",
          },
        });
      } else {
        await sendText(ctx.from, response.message);
      }
    } else {
      await sendText(ctx.from, response.message);
    }

    return true;
  } catch (error) {
    console.error("AI Property Rental handler error:", error);
    await sendText(ctx.from, t(ctx.locale, "agent.error_occurred"));
    return false;
  }
}

/**
 * Handle "Schedule Trip" request with AI agent
 */
export async function handleAIScheduleTrip(
  ctx: RouterContext,
  action: "create" | "view" | "analyze_patterns",
  requestData?: any,
): Promise<boolean> {
  try {
    const actionMessages: Record<string, string> = {
      "create": t(ctx.locale, "agent.scheduling_trip"),
      "view": t(ctx.locale, "agent.fetching_scheduled_trips"),
      "analyze_patterns": t(ctx.locale, "agent.analyzing_patterns"),
    };

    await sendText(
      ctx.from,
      actionMessages[action] || t(ctx.locale, "agent.processing"),
    );

    const response = await routeToAIAgent(ctx, {
      userId: ctx.from,
      agentType: "schedule_trip",
      flowType: action,
      requestData: {
        action,
        ...requestData,
      },
    });

    if (response.success) {
      await sendText(ctx.from, response.message);

      if (response.options && response.options.length > 0) {
        await sendAgentOptions(
          ctx,
          response.sessionId,
          response.options,
          t(ctx.locale, "schedule.options_available"),
        );

        await setState(ctx.supabase, ctx.profileId || ctx.from, {
          key: "ai_agent_selection",
          data: {
            sessionId: response.sessionId,
            agentType: "schedule_trip",
          },
        });
      }
    } else {
      await sendText(ctx.from, response.message);
    }

    return true;
  } catch (error) {
    console.error("AI Schedule Trip handler error:", error);
    await sendText(ctx.from, t(ctx.locale, "agent.error_occurred"));
    return false;
  }
}

/**
 * Handle AI agent selection from interactive list
 */
export async function handleAIAgentOptionSelection(
  ctx: RouterContext,
  state: ChatState,
  optionId: string,
): Promise<boolean> {
  const stateData = state.data as { sessionId?: string; agentType?: string };

  if (!stateData.sessionId) {
    return false;
  }

  // Extract option index from ID (format: agent_option_{sessionId}_{index})
  const match = optionId.match(/_(\d+)$/);
  if (!match) {
    return false;
  }

  const optionIndex = parseInt(match[1], 10);

  return await handleAgentSelection(ctx, stateData.sessionId, optionIndex);
}

/**
 * Handle location update for pending AI agent request
 */
export async function handleAIAgentLocationUpdate(
  ctx: RouterContext,
  state: ChatState,
  location: { latitude: number; longitude: number },
): Promise<boolean> {
  const stateKey = state.key;
  const stateData = state.data as any;

  // Route to appropriate handler based on waiting state
  if (stateKey === "ai_driver_waiting_locations") {
    // Update with location and continue
    const { vehicleType, pickup, dropoff } = stateData;

    if (!pickup) {
      await setState(ctx.supabase, ctx.profileId || ctx.from, {
        key: "ai_driver_waiting_locations",
        data: {
          ...stateData,
          pickup: location,
        },
      });
      await sendText(ctx.from, t(ctx.locale, "driver.now_provide_dropoff"));
      return true;
    } else if (!dropoff) {
      return await handleAINearbyDrivers(ctx, vehicleType, pickup, location);
    }
  }

  if (stateKey === "ai_pharmacy_waiting_location") {
    return await handleAINearbyPharmacies(
      ctx,
      location,
      stateData.medications,
      stateData.prescriptionImage,
    );
  }

  if (stateKey === "ai_quincaillerie_waiting_location") {
    return await handleAINearbyQuincailleries(
      ctx,
      location,
      stateData.items,
      stateData.itemImage,
    );
  }

  if (stateKey === "ai_shops_waiting_location") {
    return await handleAINearbyShops(
      ctx,
      location,
      stateData.items,
      stateData.itemImage,
      stateData.shopCategory,
    );
  }

  if (stateKey === "ai_property_waiting_location") {
    return await handleAIPropertyRental(
      ctx,
      stateData.action,
      stateData.rentalType,
      location,
      stateData.requestData,
    );
  }

  return false;
}

async function sendShopFallback(
  ctx: RouterContext,
  location: { latitude: number; longitude: number; text?: string },
  items?: string[],
  category?: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  let entries: Array<{
    id: string;
    name: string;
    owner_whatsapp?: string | null;
    distance_km?: number | null;
    location_text?: string | null;
    description?: string | null;
  }> = [];
  try {
    entries = await listBusinesses(
      ctx.supabase,
      { lat: location.latitude, lng: location.longitude },
      category ?? "shops",
      12,
    );
  } catch (error) {
    console.error("shops.fallback_fetch_failed", error);
  }
  const withContacts = entries.filter((entry) => entry.owner_whatsapp);
  if (!withContacts.length) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "shops.results.empty"),
      homeOnly(),
    );
    return true;
  }
  const rows = withContacts.slice(0, 10).map((entry) => ({
    id: `${SHOP_RESULT_PREFIX}${entry.id}`,
    name: entry.name ?? t(ctx.locale, "shops.results.unknown"),
    description: formatShopDescription(ctx, entry),
    whatsapp: entry.owner_whatsapp!,
  }));

  await setState(ctx.supabase, ctx.profileId, {
    key: "shop_results",
    data: {
      entries: rows.map((row) => ({
        id: row.id,
        name: row.name,
        whatsapp: row.whatsapp,
      })),
      prefill: items?.join(", ") || null,
    } as Record<string, unknown>,
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "shops.results.title"),
      body: t(ctx.locale, "shops.results.body"),
      sectionTitle: t(ctx.locale, "shops.results.section"),
      rows: [
        ...rows.map((row) => ({
          id: row.id,
          title: `🛍️ ${row.name}`,
          description: row.description,
        })),
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
          description: t(ctx.locale, "common.back_to_menu.description"),
        },
      ],
      buttonText: t(ctx.locale, "common.buttons.open"),
    },
    { emoji: "🛍️" },
  );
  return true;
}

export async function handleShopFallbackSelection(
  ctx: RouterContext,
  state: ShopResultsState,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return false;
  const prefill = state.prefill && state.prefill.length
    ? t(ctx.locale, "shops.prefill.with_items", { items: state.prefill })
    : t(ctx.locale, "shops.prefill.generic");
  const link = waChatLink(entry.whatsapp, prefill);
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "shops.results.chat_cta", { link }),
    homeOnly(),
  );
  await clearState(ctx.supabase, ctx.profileId);
  return true;
}

function formatShopDescription(
  ctx: RouterContext,
  entry: {
    distance_km?: number | null;
    location_text?: string | null;
    description?: string | null;
  },
): string {
  const parts: string[] = [];
  if (typeof entry.distance_km === "number") {
    parts.push(
      t(ctx.locale, "marketplace.distance", {
        distance: entry.distance_km >= 1
          ? `${entry.distance_km.toFixed(1)} km`
          : `${Math.round(entry.distance_km * 1000)} m`,
      }),
    );
  }
  if (entry.location_text?.trim()) {
    parts.push(entry.location_text.trim());
  } else if (entry.description?.trim()) {
    parts.push(entry.description.trim());
  }
  return parts.join(" • ");
}
