/**
 * Interactive Button Handler
 * 
 * Handles all WhatsApp interactive button callbacks for Buy & Sell:
 * - Share easyMO button
 * - My Businesses CRUD (list, create, edit, delete)
 * - Business selection
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent } from "../../_shared/observability.ts";

export interface ProfileContext {
  supabase: SupabaseClient;
  from: string;
  profileId: string;
  locale: "en" | "fr" | "sw" | "rw";
}

/**
 * Handle interactive button callbacks
 * 
 * @param buttonId - The button ID from WhatsApp interactive message
 * @param from - User phone number
 * @param supabase - Supabase client
 * @param correlationId - Request correlation ID for logging
 * @returns handled: true if button was handled, false otherwise
 */
export async function handleInteractiveButton(
  buttonId: string,
  from: string,
  supabase: SupabaseClient,
  correlationId?: string,
): Promise<{ handled: boolean; action?: string }> {
  // Get profile context once (avoid duplicate queries)
  const ctx = await getProfileContext(from, supabase);
  if (!ctx) {
    logStructuredEvent("BUY_SELL_BUTTON_NO_PROFILE", {
      from: `***${from.slice(-4)}`,
      buttonId,
      correlationId,
    }, "warn");
    return { handled: false };
  }

  // Handle initial menu selection from home menu
  if (buttonId === "buy_sell" || buttonId === "buy_and_sell" || buttonId === "business_broker_agent" || buttonId === "buy_and_sell_agent") {
    const { MarketplaceAgent, WELCOME_MESSAGE } = await import("../core/agent.ts");
    const { sendText } = await import("../../_shared/wa-webhook-shared/wa/client.ts");
    
    // Load or create context
    const context = await MarketplaceAgent.loadContext(from, supabase);
    const isNewSession = !context.conversationHistory || context.conversationHistory.length === 0;
    
    if (isNewSession) {
      // Send welcome message for new sessions
      await sendText(from, WELCOME_MESSAGE);
      logStructuredEvent("BUY_SELL_WELCOME_FROM_MENU", {
        from: `***${from.slice(-4)}`,
        correlationId,
      });
    } else {
      // For returning users, just send a greeting
      await sendText(from, "🛒 *Buy & Sell*\n\nHow can I help you today?");
    }
    
    return { handled: true, action: "welcome_shown" };
  }

  // Handle share button
  if (buttonId === "share_easymo") {
    const { handleShareEasyMOButton } = await import("../../_shared/wa-webhook-shared/utils/share-button-handler.ts");
    await handleShareEasyMOButton(ctx, "wa-webhook-buy-sell");
    
    logStructuredEvent("BUY_SELL_SHARE_BUTTON", {
      from: `***${from.slice(-4)}`,
      correlationId,
    });
    
    return { handled: true, action: "share_button" };
  }

  // Handle My Businesses buttons
  if (buttonId === "MY_BUSINESSES" || buttonId === "my_business") {
    const { listMyBusinesses } = await import("../my-business/list.ts");
    await listMyBusinesses(ctx);
    
    logStructuredEvent("BUY_SELL_LIST_BUSINESSES", {
      from: `***${from.slice(-4)}`,
      profileId: ctx.profileId,
      correlationId,
    });
    
    return { handled: true, action: "list_businesses" };
  }

  if (buttonId === "CREATE_BUSINESS") {
    const { startCreateBusiness } = await import("../my-business/list.ts");
    await startCreateBusiness(ctx);
    
    logStructuredEvent("BUY_SELL_CREATE_BUSINESS_START", {
      from: `***${from.slice(-4)}`,
      profileId: ctx.profileId,
      correlationId,
    });
    
    return { handled: true, action: "create_business" };
  }

  if (buttonId.startsWith("BIZ::")) {
    const businessId = buttonId.replace("BIZ::", "");
    const { handleBusinessSelection } = await import("../my-business/list.ts");
    await handleBusinessSelection(ctx, businessId);
    
    logStructuredEvent("BUY_SELL_SELECT_BUSINESS", {
      from: `***${from.slice(-4)}`,
      businessId,
      correlationId,
    });
    
    return { handled: true, action: "select_business" };
  }

  if (buttonId.startsWith("EDIT_BIZ::")) {
    const businessId = buttonId.replace("EDIT_BIZ::", "");
    const { startEditBusiness } = await import("../my-business/update.ts");
    await startEditBusiness(ctx, businessId);
    
    logStructuredEvent("BUY_SELL_EDIT_BUSINESS_START", {
      from: `***${from.slice(-4)}`,
      businessId,
      correlationId,
    });
    
    return { handled: true, action: "edit_business" };
  }

  if (buttonId.startsWith("DELETE_BIZ::")) {
    const businessId = buttonId.replace("DELETE_BIZ::", "");
    const { confirmDeleteBusiness } = await import("../my-business/delete.ts");
    await confirmDeleteBusiness(ctx, businessId);
    
    logStructuredEvent("BUY_SELL_DELETE_CONFIRM", {
      from: `***${from.slice(-4)}`,
      businessId,
      correlationId,
    });
    
    return { handled: true, action: "confirm_delete" };
  }

  if (buttonId.startsWith("CONFIRM_DELETE_BIZ::")) {
    const businessId = buttonId.replace("CONFIRM_DELETE_BIZ::", "");
    const { handleDeleteBusiness } = await import("../my-business/delete.ts");
    await handleDeleteBusiness(ctx, businessId);
    
    logStructuredEvent("BUY_SELL_DELETE_BUSINESS", {
      from: `***${from.slice(-4)}`,
      businessId,
      correlationId,
    });
    
    return { handled: true, action: "delete_business" };
  }

  if (buttonId.startsWith("EDIT_BIZ_NAME::") || buttonId.startsWith("EDIT_BIZ_DESC::") || buttonId.startsWith("BACK_BIZ::")) {
    const businessId = buttonId.replace(/^(EDIT_BIZ_NAME|EDIT_BIZ_DESC|BACK_BIZ)::/, "");
    const action = buttonId.split("::")[0];
    
    if (action === "EDIT_BIZ_NAME" || action === "EDIT_BIZ_DESC") {
      const { promptEditField } = await import("../my-business/update.ts");
      const field = action === "EDIT_BIZ_NAME" ? "name" : "description";
      await promptEditField(ctx, businessId, field);
      
      logStructuredEvent("BUY_SELL_EDIT_FIELD_PROMPT", {
        from: `***${from.slice(-4)}`,
        businessId,
        field,
        correlationId,
      });
      
      return { handled: true, action: `edit_${field}` };
    } else if (action === "BACK_BIZ") {
      const { handleBusinessSelection } = await import("../my-business/list.ts");
      await handleBusinessSelection(ctx, businessId);
      
      logStructuredEvent("BUY_SELL_BACK_TO_BUSINESS", {
        from: `***${from.slice(-4)}`,
        businessId,
        correlationId,
      });
      
      return { handled: true, action: "back_to_business" };
    }
  }

  // Button not recognized
  logStructuredEvent("BUY_SELL_UNKNOWN_BUTTON", {
    from: `***${from.slice(-4)}`,
    buttonId,
    correlationId,
  }, "warn");
  
  return { handled: false };
}

/**
 * Get profile context for a user
 * Fetches profile once and returns structured context
 * Exported for use in other handlers
 */
export async function getProfileContext(userPhone: string, supabase: SupabaseClient): Promise<ProfileContext | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, language")
    .eq("whatsapp_number", userPhone)
    .maybeSingle();
  
  if (!profile) return null;
  
  return {
    supabase,
    from: userPhone,
    profileId: profile.user_id,
    locale: (profile.language || "en") as "en" | "fr" | "sw" | "rw",
  };
}
