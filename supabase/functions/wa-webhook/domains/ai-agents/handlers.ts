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
  sendButtonsMessage,
} from "../../utils/reply.ts";
import { t } from "../../i18n/translator.ts";
import { setState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";

/**
 * Handle "Nearby Drivers" request with AI agent
 * DATABASE SEARCH ONLY - No web search
 */


/**
 * Handle "Nearby Pharmacies" request with AI agent
 */


/**
 * Handle "Nearby Quincailleries" request with AI agent
 */


/**
 * Handle "Nearby Shops" request with AI agent
 * TWO-PHASE APPROACH:
 * Phase 1: Immediately show top 9 nearby shops from database
 * Phase 2: AI agent processes in background for curated shortlist
 */


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
    console.error("AI Property Rental handler error:", error);
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


/**
 * Phase 1: Send immediate database results (top 9 nearby shops)
 * This provides instant results while AI agent processes in background
 */



