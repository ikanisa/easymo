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
} from "../types.ts";
import type { ChatState } from "../state/store.ts";
import {
  handleAgentSelection,
  routeToAIAgent,
  sendAgentOptions,
} from "./integration.ts";
import { sendText } from "../wa/client.ts";
import {
  buildButtons,
  homeOnly,
  sendButtonsMessage,
  sendListMessage,
} from "../utils/reply.ts";
import { t } from "../i18n/translator.ts";
import { clearState, setState } from "../state/store.ts";
import { IDS } from "../wa/ids.ts";
import { listBusinesses } from "../../_shared/wa-webhook-shared/rpc/marketplace.ts";
import { waChatLink } from "../utils/links.ts";

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
      const instructions = t(ctx.locale, "location.share.instructions");
      await sendText(
        ctx.from,
        t(ctx.locale, "driver.provide_locations", { instructions }),
      );
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

    await sendText(ctx.from, "🚖 Looking for drivers near you...");

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
    logStructuredEvent("ERROR", { error: "AI Nearby Drivers handler error:", error }, "error");

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
      const instructions = t(ctx.locale, "location.share.instructions");
      await sendText(
        ctx.from,
        t(ctx.locale, "pharmacy.provide_location", { instructions }),
      );
      await setState(ctx.supabase, ctx.profileId || ctx.from, {
        key: "ai_pharmacy_waiting_location",
        data: {
          medications,
          prescriptionImage,
        },
      });
      return true;
    }

    await sendText(ctx.from, t(ctx.locale, "pharmacy.searching"));

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
      // Fallback: fetch from database
      await sendText(ctx.from, t(ctx.locale, "pharmacy.finding_nearby"));
      
      // Database fallback - fetch top 10 pharmacies by distance
      try {
        interface PharmacyBusiness {
          id: string;
          name: string;
          phone_number?: string;
          location?: unknown;
          address?: string;
        }
        
        const { data: pharmacies, error } = await ctx.supabase
          .from("businesses")
          .select("id, name, phone_number, location, address")
          .eq("business_type", "pharmacy")
          .eq("is_active", true)
          .limit(10);

        if (error) throw error;

        if (pharmacies && pharmacies.length > 0) {
          // Build list of pharmacy options
          const pharmacyRows = (pharmacies as PharmacyBusiness[]).map((pharmacy) => ({
            id: `pharmacy::${pharmacy.id}`,
            title: pharmacy.name || "Pharmacy",
            description: pharmacy.address || t(ctx.locale, "pharmacy.tap_for_details"),
          }));

          await sendListMessage(ctx, {
            title: t(ctx.locale, "pharmacy.results_title"),
            body: t(ctx.locale, "pharmacy.found_count", { count: pharmacies.length }),
            sectionTitle: t(ctx.locale, "pharmacy.nearby"),
            rows: pharmacyRows,
            buttonText: t(ctx.locale, "pharmacy.select"),
          });
        } else {
          await sendButtonsMessage(
            ctx,
            t(ctx.locale, "pharmacy.no_results"),
            buildButtons(
              { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
            )
          );
        }
      } catch (dbError) {
        logStructuredEvent("ERROR", { error: "Database fallback error:", dbError }, "error");
        await sendButtonsMessage(
          ctx,
          t(ctx.locale, "pharmacy.error"),
          buildButtons(
            { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
          )
        );
      }
    }

    return true;
  } catch (error) {
    logStructuredEvent("ERROR", { error: "AI Pharmacy handler error:", error }, "error");
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "pharmacy.error"),
      buildButtons(
        { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
      )
    );
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
      const instructions = t(ctx.locale, "location.share.instructions");
      await sendText(
        ctx.from,
        t(ctx.locale, "quincaillerie.provide_location", { instructions }),
      );
      await setState(ctx.supabase, ctx.profileId || ctx.from, {
        key: "ai_quincaillerie_waiting_location",
        data: {
          items,
          itemImage,
        },
      });
      return true;
    }

    await sendText(ctx.from, t(ctx.locale, "quincaillerie.searching"));

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
      // Fallback: fetch from database
      await sendText(ctx.from, t(ctx.locale, "quincaillerie.finding_nearby"));
      
      // Database fallback - fetch top 10 quincailleries by distance
      try {
        interface QuincaillerieBusiness {
          id: string;
          name: string;
          phone_number?: string;
          location?: unknown;
          address?: string;
        }
        
        const { data: quincailleries, error } = await ctx.supabase
          .from("businesses")
          .select("id, name, phone_number, location, address")
          .eq("business_type", "hardware")
          .eq("is_active", true)
          .limit(10);

        if (error) throw error;

        if (quincailleries && quincailleries.length > 0) {
          // Build list of quincaillerie options
          const quincaillerieRows = (quincailleries as QuincaillerieBusiness[]).map((shop) => ({
            id: `quincaillerie::${shop.id}`,
            title: shop.name || "Quincaillerie",
            description: shop.address || t(ctx.locale, "quincaillerie.tap_for_details"),
          }));

          await sendListMessage(ctx, {
            title: t(ctx.locale, "quincaillerie.results_title"),
            body: t(ctx.locale, "quincaillerie.found_count", { count: quincailleries.length }),
            sectionTitle: t(ctx.locale, "quincaillerie.nearby"),
            rows: quincaillerieRows,
            buttonText: t(ctx.locale, "quincaillerie.select"),
          });
        } else {
          await sendButtonsMessage(
            ctx,
            t(ctx.locale, "quincaillerie.no_results"),
            buildButtons(
              { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
            )
          );
        }
      } catch (dbError) {
        logStructuredEvent("ERROR", { error: "Database fallback error:", dbError }, "error");
        await sendButtonsMessage(
          ctx,
          t(ctx.locale, "quincaillerie.error"),
          buildButtons(
            { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
          )
        );
      }
    }

    return true;
  } catch (error) {
    logStructuredEvent("ERROR", { error: "AI Quincaillerie handler error:", error }, "error");
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "quincaillerie.error"),
      buildButtons(
        { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
      )
    );
    return false;
  }
}

/**
 * Handle "Nearby Shops" request with AI agent
 * TWO-PHASE APPROACH:
 * Phase 1: Immediately show top 9 nearby shops from database
 * Phase 2: AI agent processes in background for curated shortlist
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
      const instructions = t(ctx.locale, "location.share.instructions");
      await sendText(
        ctx.from,
        t(ctx.locale, "shops.provide_location", { instructions }),
      );
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

    // Phase 1: Immediately send database results (top 9)
    const instantResults = await sendShopDatabaseResults(ctx, location, items, shopCategory);
    
    // Phase 2: Trigger AI agent in background (non-blocking)
    triggerShopsAgentBackground(ctx, location, items, itemImage, shopCategory).catch((error) => {
      logStructuredEvent("ERROR", { error: "shops.background_agent_error", error }, "error");
    });

    return instantResults;
  } catch (error) {
    logStructuredEvent("ERROR", { error: "AI Shops handler error:", error }, "error");
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "shops.error"),
      buildButtons(
        { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
      )
    );
    if (location) {
      return await sendShopDatabaseResults(ctx, location, items, shopCategory);
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
      const instructions = t(ctx.locale, "location.share.instructions");
      await sendText(
        ctx.from,
        t(ctx.locale, "property.provide_location", { instructions }),
      );
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
        await sendButtonsMessage(
          ctx,
          response.message || t(ctx.locale, "property.no_results"),
          buildButtons(
            { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
          )
        );
      }
    } else {
      await sendButtonsMessage(
        ctx,
        response.message || t(ctx.locale, "property.error"),
        buildButtons(
          { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
        )
      );
    }

    return true;
  } catch (error) {
    logStructuredEvent("ERROR", { error: "AI Property Rental handler error:", error }, "error");
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "property.error"),
      buildButtons(
        { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
      )
    );
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
    logStructuredEvent("ERROR", { error: "AI Schedule Trip handler error:", error }, "error");
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

/**
 * Phase 2: Background AI agent processing for shops
 * Agent contacts shops on behalf of user to create curated shortlist
 */
async function triggerShopsAgentBackground(
  ctx: RouterContext,
  location: { latitude: number; longitude: number; text?: string },
  items?: string[],
  itemImage?: string,
  shopCategory?: string,
): Promise<void> {
  if (!ctx.profileId) return;
  
  try {
    // Send notification that AI agent is working in background
    await sendText(
      ctx.from,
      t(ctx.locale, "shops.agent_processing_background"),
    );
    
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

    if (response.success && response.options?.length) {
      // AI agent found curated results - send them
      await sendText(
        ctx.from,
        t(ctx.locale, "shops.agent_curated_ready"),
      );
      
      await sendAgentOptions(
        ctx,
        response.sessionId,
        response.options,
        t(ctx.locale, "shops.agent_curated_results"),
      );
      
      await setState(ctx.supabase, ctx.profileId, {
        key: "ai_agent_selection",
        data: {
          sessionId: response.sessionId,
          agentType: "shops",
        },
      });
    } else if (response.message) {
      // AI agent completed but no better results
      await sendText(ctx.from, response.message);
    }
  } catch (error) {
    logStructuredEvent("ERROR", { error: "shops.background_agent_failure", error }, "error");
    // Silent failure - user already has database results
  }
}

/**
 * Phase 1: Send immediate database results (top 9 nearby shops)
 * This provides instant results while AI agent processes in background
 */
async function sendShopDatabaseResults(
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
    // Fetch top 12, filter for contacts, show top 9
    entries = await listBusinesses(
      ctx.supabase,
      { lat: location.latitude, lng: location.longitude },
      category ?? "shops_services",
      12,
    );
  } catch (error) {
    logStructuredEvent("ERROR", { error: "shops.database_fetch_failed", error }, "error");
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
  
  // Show top 9 results
  const top9 = withContacts.slice(0, 9);
  const rows = top9.map((entry) => ({
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
      body: t(ctx.locale, "shops.results.instant_body"),
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
    logStructuredEvent("ERROR", { error: "shops.fallback_fetch_failed", error }, "error");
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
