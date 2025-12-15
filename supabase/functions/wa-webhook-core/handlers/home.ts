/**
 * Home Menu Handler
 * Handles home menu display and navigation
 * Database-driven menu from whatsapp_home_menu_items table
 */

import type { RouterContext, HandlerResult } from "../../_shared/types/index.ts";
import { StateMachine } from "../../_shared/state/index.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

/**
 * Handle home menu request - database-driven
 */
export async function handleHomeMenu(ctx: RouterContext): Promise<HandlerResult> {
  try {
    logStructuredEvent("HOME_MENU_REQUESTED", {
      requestId: ctx.requestId,
      userId: ctx.profileId,
    }, "info");

    // Clear state (return to home)
    if (ctx.profileId) {
      const sm = new StateMachine(ctx.supabase);
      await sm.clearState(ctx.profileId);
    }

    // Get menu items from database
    const { data: menuItems, error } = await ctx.supabase
      .from("whatsapp_home_menu_items")
      .select("key, title, description, icon")
      .eq("is_active", true)
      .contains("active_countries", ["RW"]) // Rwanda only
      .order("display_order", { ascending: true })
      .limit(10);

    if (error) {
      logStructuredEvent("HOME_MENU_DB_ERROR", {
        requestId: ctx.requestId,
        error: error.message,
      }, "error");
      throw new Error("Failed to load menu");
    }

    if (!menuItems || menuItems.length === 0) {
      logStructuredEvent("HOME_MENU_EMPTY", { requestId: ctx.requestId }, "warn");
      throw new Error("No menu items available");
    }

    // Build WhatsApp list message
    const sections = [{
      title: "EasyMO Services",
      rows: menuItems.map((item: any) => ({
        id: item.key,
        title: `${item.icon || ""} ${item.title}`.trim(),
        description: item.description || "",
      })),
    }];

    // Send WhatsApp list message
    const messageData = {
      messaging_product: "whatsapp",
      to: ctx.from,
      type: "interactive",
      interactive: {
        type: "list",
        header: {
          type: "text",
          text: "🏠 Home Menu",
        },
        body: {
          text: "Welcome to EasyMO! Choose a service:",
        },
        action: {
          button: "View Services",
          sections,
        },
      },
    };

    // Send via WhatsApp API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${Deno.env.get("WA_PHONE_NUMBER_ID")}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("WA_ACCESS_TOKEN")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp API error: ${errorText}`);
    }

    const result = await response.json();

    logStructuredEvent("HOME_MENU_SENT", {
      requestId: ctx.requestId,
      userId: ctx.profileId,
      messageId: result.messages?.[0]?.id,
      itemCount: menuItems.length,
    });

    return { handled: true };
  } catch (error) {
    logStructuredEvent("HOME_MENU_ERROR", {
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    return { handled: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Handle back to home button
 */
export async function handleBackHome(ctx: RouterContext): Promise<HandlerResult> {
  return handleHomeMenu(ctx);
}
