/**
 * Interactive Button Handler
 * 
 * Handles all WhatsApp interactive button callbacks for Buy & Sell:
 * - Share easyMO button
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
    const { MarketplaceAgent, getWelcomeMessage, getGreetingMessage } = await import("../core/agent.ts");
    const { sendText } = await import("../../_shared/wa-webhook-shared/wa/client.ts");
    
    // Load or create context
    const context = await MarketplaceAgent.loadContext(from, supabase);
    const isNewSession = !context.conversationHistory || context.conversationHistory.length === 0;
    
    // Get user locale from context
    const locale = ctx.locale === "rw" ? "en" : ctx.locale; // Map "rw" to "en" for compatibility
    
    if (isNewSession) {
      // Send localized welcome message for new sessions
      const welcomeMessage = await getWelcomeMessage(locale);
      await sendText(from, welcomeMessage);
      logStructuredEvent("BUY_SELL_WELCOME_FROM_MENU", {
        from: `***${from.slice(-4)}`,
        locale,
        correlationId,
      });
    } else {
      // For returning users, send localized greeting
      const greetingMessage = await getGreetingMessage(locale);
      await sendText(from, greetingMessage);
    }
    
    return { handled: true, action: "welcome_shown" };
  }

  // Handle share button
  if (buttonId === "share_easymo") {
    const { handleShareEasyMOButton } = await import("../../_shared/wa-webhook-shared/utils/share-button-handler.ts");
    // Convert ProfileContext to RouterContext format
    const routerCtx = {
      supabase: ctx.supabase,
      from: ctx.from,
      profileId: ctx.profileId,
      locale: (ctx.locale === "rw" ? "en" : ctx.locale) as "en" | "fr" | "sw",
    };
    await handleShareEasyMOButton(routerCtx, "notify-buyers");
    
    logStructuredEvent("BUY_SELL_SHARE_BUTTON", {
      from: `***${from.slice(-4)}`,
      correlationId,
    });
    
    return { handled: true, action: "share_button" };
  }

  // My Businesses feature has been removed
  // All my-business button handlers have been deleted

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
  // Try both wa_id and phone_number
  const normalizedPhone = userPhone.startsWith('+') ? userPhone : `+${userPhone}`;
  const waId = userPhone.replace(/^\+/, '');
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, language")
    .or(`wa_id.eq.${waId},phone_number.eq.${normalizedPhone},phone_number.eq.${userPhone}`)
    .maybeSingle();
  
  if (!profile) return null;
  
  return {
    supabase,
    from: userPhone,
    profileId: profile.user_id,
    locale: (profile.language || "en") as "en" | "fr" | "sw" | "rw",
  };
}
