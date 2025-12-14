/**
 * State Machine Handler
 * 
 * Handles multi-step conversational flows for business management:
 * - Business creation workflow
 * - Business editing workflow
 * - Business search workflow
 * - Manual business addition workflow
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import type { ProfileContext } from "./interactive-buttons.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

/**
 * Handle state transitions for multi-step workflows
 * 
 * @param state - Current user state from database
 * @param text - User's text message
 * @param ctx - Profile context with supabase client
 * @returns handled: true if state was handled, false otherwise
 */
export async function handleStateTransition(
  state: any,
  text: string,
  ctx: ProfileContext,
  correlationId?: string,
): Promise<{ handled: boolean }> {
  if (!state?.key) return { handled: false };

  // Business creation - name input
  if (state.key === "business_create_name") {
    const { handleCreateBusinessName } = await import("../my-business/create.ts");
    await handleCreateBusinessName(ctx, text);
    
    logStructuredEvent("BUY_SELL_CREATE_NAME_INPUT", {
      from: `***${ctx.from.slice(-4)}`,
      nameLength: text.length,
      correlationId,
    });
    
    return { handled: true };
  }

  // Business edit - name field
  if (state.key === "business_edit_name" && state.data) {
    const { handleUpdateBusinessField } = await import("../my-business/update.ts");
    await handleUpdateBusinessField(ctx, String(state.data.businessId), "name", text);
    
    logStructuredEvent("BUY_SELL_EDIT_NAME_INPUT", {
      from: `***${ctx.from.slice(-4)}`,
      businessId: state.data.businessId,
      correlationId,
    });
    
    return { handled: true };
  }

  // Business edit - description field
  if (state.key === "business_edit_description" && state.data) {
    const { handleUpdateBusinessField } = await import("../my-business/update.ts");
    await handleUpdateBusinessField(ctx, String(state.data.businessId), "description", text);
    
    logStructuredEvent("BUY_SELL_EDIT_DESC_INPUT", {
      from: `***${ctx.from.slice(-4)}`,
      businessId: state.data.businessId,
      correlationId,
    });
    
    return { handled: true };
  }

  // Business search - name input
  if (state.key === "business_search" && state.data?.step === "awaiting_name") {
    const { handleBusinessNameSearch } = await import("../my-business/search.ts");
    await handleBusinessNameSearch(ctx, text);
    
    logStructuredEvent("BUY_SELL_SEARCH_NAME_INPUT", {
      from: `***${ctx.from.slice(-4)}`,
      searchQuery: text.slice(0, 50),
      correlationId,
    });
    
    return { handled: true };
  }

  // Manual business add - step-by-step
  if (state.key === "business_add_manual" && state.data) {
    const { handleManualBusinessStep } = await import("../my-business/add_manual.ts");
    await handleManualBusinessStep(ctx, state.data, text);
    
    logStructuredEvent("BUY_SELL_MANUAL_ADD_STEP", {
      from: `***${ctx.from.slice(-4)}`,
      step: state.data.step,
      correlationId,
    });
    
    return { handled: true };
  }

  // State key not recognized
  logStructuredEvent("BUY_SELL_UNKNOWN_STATE", {
    from: `***${ctx.from.slice(-4)}`,
    stateKey: state.key,
    correlationId,
  }, "warn");
  
  return { handled: false };
}
