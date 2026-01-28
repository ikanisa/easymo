/**
 * Home Menu Handler
 * 
 * Handles display and interaction with the WhatsApp home menu
 * Extracted from router.ts for better separation of concerns
 */

/// <reference lib="deno.ns" />

// Allow Node-based unit tests to import this module without the Deno global.
// deno-lint-ignore no-explicit-any
declare const Deno: { env?: { get(key: string): string | undefined } } | undefined;

import { logError, logInfo,logWarn } from "../../_shared/correlation-logging.ts";
import { buildMenuKeyMap } from "../../_shared/route-config.ts";
import {
  clearActiveService,
  setActiveService,
} from "../../_shared/session-manager.ts";
import { supabase } from "../../_shared/wa-webhook-shared/config.ts";
import type { RouterContext, WhatsAppMessage,WhatsAppWebhookPayload } from "../../_shared/wa-webhook-shared/types.ts";
import { getRoutingText } from "../../_shared/wa-webhook-shared/utils/messages.ts";
import { sendListMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { getFirstMessage } from "../utils/message-extraction.ts";
import { handleInsuranceAgentRequest } from "./insurance.ts";

// Helper function for safe Deno.env access
const getEnvValue = (key: string): string | undefined => {
  return typeof Deno !== "undefined" && Deno?.env?.get ? Deno.env.get(key) : undefined;
};

// Constants
const SERVICE_KEY_MAP = buildMenuKeyMap();
const MICROSERVICES_BASE_URL = `${getEnvValue("SUPABASE_URL") ?? ""}/functions/v1`;
const ROUTER_TIMEOUT_MS = Math.max(Number(getEnvValue("WA_ROUTER_TIMEOUT_MS") ?? "4000") || 4000, 1000);

type WhatsAppHomeMenuItem = {
  id: string;
  key: string;
  // Different environments/scripts have used either `name` or `title`.
  // Keep both to be resilient and always build a valid WhatsApp list row title.
  name?: string | null;
  title?: string | null;
  description?: string | null;
  icon?: string | null;
  display_order?: number;
  is_active?: boolean;
  target_service?: string | null;
  // active_countries removed - Rwanda-only system
};

type HomeMenuRow = { id: string; title: string; description?: string };

function defaultTitleForMenuKey(key: string): string {
  const normalized = (key ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    rides: "Rides",
    rides_agent: "Rides",
    mobility: "Rides",
    nearby_drivers: "Rides",
    nearby_passengers: "Rides",
    schedule_trip: "Rides",

    buy_sell: "Buy & Sell",
    buy_and_sell: "Buy & Sell",
    buy_and_sell_agent: "Buy & Sell",
    business_broker_agent: "Buy & Sell",
    marketplace: "Buy & Sell",
    shops_services: "Buy & Sell",

    insurance: "Insurance",
    motor_insurance: "Insurance",

    profile: "Profile",
    profile_assets: "Profile",

    wallet: "Wallet",
    momo_qr: "MoMo QR",
    token_transfer: "Wallet",

    support: "Support",
    support_agent: "Support",
    customer_support: "Support",
    help: "Support",
  };
  if (normalized && map[normalized]) return map[normalized];
  const pretty = normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
  return pretty || "Option";
}

function getMenuSelectionId(message?: WhatsAppMessage): string | null {
  if (!message || message.type !== "interactive") return null;
  const interactive = (message as { interactive?: Record<string, unknown> }).interactive;
  if (!interactive) return null;
  const listReply = interactive.list_reply as { id?: string } | undefined;
  if (listReply?.id && listReply.id.trim().length) {
    return listReply.id.trim().toLowerCase();
  }
  const buttonReply = interactive.button_reply as { id?: string } | undefined;
  if (buttonReply?.id && buttonReply.id.trim().length) {
    return buttonReply.id.trim().toLowerCase();
  }
  return null;
}

async function fetchHomeMenuItems(): Promise<WhatsAppHomeMenuItem[]> {
  const { data, error } = await supabase
    .from("whatsapp_home_menu_items")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    logError("FETCH_HOME_MENU_FAILED", { error: error.message }, { correlationId: crypto.randomUUID() });
    return [];
  }

  return data as WhatsAppHomeMenuItem[];
}

/**
 * Handle home menu display and interactions
 */
export async function handleHomeMenu(
  payload: WhatsAppWebhookPayload,
  headers?: Headers,
  correlationId?: string,
): Promise<Response> {
  const corrId = correlationId || crypto.randomUUID();
  logInfo("HANDLE_HOME_MENU_START", {}, { correlationId: corrId });
  
  const message = getFirstMessage(payload);
  if (!message) {
    // Check if this is just a status update (delivered, read, sent)
    const hasStatusUpdate = payload?.entry?.[0]?.changes?.[0]?.value?.statuses;
    if (hasStatusUpdate) {
      logInfo("STATUS_UPDATE_IGNORED", {}, { correlationId: corrId });
      return new Response(JSON.stringify({ success: true, message: "Status update acknowledged" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    logInfo("NO_MESSAGE_IN_PAYLOAD", {}, { correlationId: corrId });
    return new Response(JSON.stringify({ success: true, message: "No message to process" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const phoneNumber = message.from;
  const text = getRoutingText(message);
  const interactiveId = getMenuSelectionId(message);
  const normalizedText = text?.trim().toLowerCase() ?? null;
  const selection = interactiveId ?? normalizedText;
  const isInteractiveSelection = Boolean(interactiveId);
  
  logInfo("MESSAGE_RECEIVED", { from: phoneNumber, text: selection ?? null }, { correlationId: corrId });
  
  // Check for help/support keywords
  if (normalizedText && /^(help|support|assist|contact|help me|need help|customer service)$/i.test(normalizedText)) {
    logInfo("HELP_REQUEST_DETECTED", { from: phoneNumber }, { correlationId: corrId });
    
    const { handleHelpRequest } = await import("./help-support.ts");
    await handleHelpRequest(phoneNumber);
    
    return new Response(JSON.stringify({ success: true, help_sent: true }), { status: 200 });
  }
  
  if (selection === "menu" || selection === "home") {
    logInfo("MENU_REQUESTED", { from: phoneNumber }, { correlationId: corrId });
    if (phoneNumber) await clearActiveService(supabase, phoneNumber);
  } else if (isInteractiveSelection && selection === "insurance") {
    // Handle insurance inline - show contacts directly
    logInfo("INSURANCE_SELECTED", { from: phoneNumber }, { correlationId: corrId });
    if (phoneNumber) {
      try {
        await handleInsuranceAgentRequest(phoneNumber, corrId);
      } catch (error) {
        logError("INSURANCE_HANDLER_ERROR", { 
          error: error instanceof Error ? error.message : String(error) 
        }, { correlationId: corrId });
        // Continue to show menu even if insurance handler fails
      }
    }
    return new Response(JSON.stringify({ success: true, insurance_sent: true }), { status: 200 });
  } else if (selection && isInteractiveSelection) {
    const targetService = SERVICE_KEY_MAP[selection] ?? null;
    if (targetService) {
      logInfo("ROUTING_TO_SERVICE", { service: targetService, selection }, { correlationId: corrId });
      if (phoneNumber) await setActiveService(supabase, phoneNumber, targetService);
      const url = `${MICROSERVICES_BASE_URL}/${targetService}`;
      const forwardHeaders = new Headers(headers);
      forwardHeaders.set("Content-Type", "application/json");
      forwardHeaders.set("X-Routed-From", "wa-webhook-core");
      forwardHeaders.set("X-Menu-Selection", selection);
      const serviceRoleKey = getEnvValue("SUPABASE_SERVICE_ROLE_KEY");
      if (serviceRoleKey) {
        forwardHeaders.set("Authorization", `Bearer ${serviceRoleKey}`);
      }

      try {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ROUTER_TIMEOUT_MS);
        
        const response = await fetch(url, {
          method: "POST",
          headers: forwardHeaders,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.status === 404) {
          logWarn(
            "WA_CORE_MENU_SERVICE_NOT_FOUND",
            { service: targetService, status: response.status },
            { correlationId: corrId },
          );
          // Fall through to show home menu
        } else {
          logInfo("FORWARDED", { service: targetService, status: response.status }, { correlationId: corrId });
          return response;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError("FORWARD_FAILED", { service: targetService, error: errorMessage }, { correlationId: corrId });
        // Fall through to show home menu on error
      }
    }
  } else if (selection) {
    // Typed text should NOT act as service selection; always show the home menu instead.
    logInfo("TEXT_NOT_RECOGNIZED", { input: selection }, { correlationId: corrId });
    if (phoneNumber) await clearActiveService(supabase, phoneNumber);
  } else if (phoneNumber) {
    await clearActiveService(supabase, phoneNumber);
  }

  // Show home menu - interactive list message
  logInfo("SHOWING_HOME_MENU", { to: phoneNumber }, { correlationId: corrId });

  const ctx: RouterContext = {
    supabase,
    from: phoneNumber,
    locale: "en",
  };

  try {
    // Fetch dynamic menu items
    const menuItems = await fetchHomeMenuItems();
    
    // Build rows ensuring title is never empty (required by WhatsApp API)
    let fallbackTitleCount = 0;
    const rows: HomeMenuRow[] = menuItems.flatMap((item): HomeMenuRow[] => {
      const key = String(item.key ?? "").trim();
      if (!key) {
        logWarn("HOME_MENU_ITEM_MISSING_KEY", { id: item.id ?? null }, { correlationId: corrId });
        return [];
      }

      const dbTitle = String(item.name ?? item.title ?? "").trim();
      if (!dbTitle) fallbackTitleCount++;

      const baseTitle = dbTitle || defaultTitleForMenuKey(key);
      const icon = String(item.icon ?? "").trim();
      const title = icon ? `${icon} ${baseTitle}`.trim() : baseTitle;
      const description = String(item.description ?? "").trim();

      const baseRow: HomeMenuRow = { id: key, title };
      return description ? [{ ...baseRow, description }] : [baseRow];
    });

    // Fallback if no items found
    if (rows.length === 0) {
      logWarn("NO_ACTIVE_MENU_ITEMS", { message: "No active menu items found in DB, using fallback" }, { correlationId: corrId });
      rows.push(
        { id: "rides", title: "Rides & Transport", description: "Request a ride or delivery" },
        { id: "buy_and_sell", title: "Buy & Sell", description: "Browse shops and services" },
        { id: "wallet", title: "Wallet & MOMO QR", description: "Manage funds and QR codes" },
        { id: "profile", title: "Profile", description: "Manage your account" },
        { id: "support", title: "Support", description: "Get help from our team" }
      );
    } else if (fallbackTitleCount > 0) {
      logWarn("HOME_MENU_ROW_TITLE_FALLBACK_USED", { count: fallbackTitleCount }, { correlationId: corrId });
    }

    await sendListMessage(ctx, {
      title: "easyMO Services",
      body: "✨ Hello 👋 Do more with easyMO in Rwanda - Rides, Buy & Sell, MOMO QR codes, Insurance and more.",
      buttonText: "View Services",
      sectionTitle: "Services",
      rows: rows,
    });

    logInfo("MENU_SENT_SUCCESS", { to: phoneNumber?.slice(-4), itemCount: rows.length }, { correlationId: corrId });
    return new Response(JSON.stringify({ success: true, menu_shown: true }), { status: 200 });
  } catch (error) {
    logError("SEND_MESSAGE_FAILED", { error: String(error) }, { correlationId: corrId });
    return new Response(JSON.stringify({ error: "Failed to send message" }), { status: 500 });
  }
}
