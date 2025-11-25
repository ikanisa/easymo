/**
 * Marketplace AI Agent Webhook Handler
 *
 * Natural language AI agent for connecting buyers and sellers in Rwanda via WhatsApp.
 * Features:
 * - Conversational selling flow (create listings)
 * - Conversational buying flow (search and match)
 * - Proximity-based matching
 * - Integration with business directory
 *
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { MarketplaceAgent } from "./agent.ts";
import {
  extractWhatsAppMessage,
  logMarketplaceEvent,
  parseLocationFromText,
  parseWhatsAppLocation,
} from "./utils/index.ts";

// =====================================================
// CONFIGURATION
// =====================================================



const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// Feature flag for AI agent
const AI_AGENT_ENABLED = Deno.env.get("FEATURE_MARKETPLACE_AI") === "true";

serve(async (req: Request): Promise<Response> => {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  // Health check endpoint
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "healthy",
        service: "wa-webhook-marketplace",
        aiEnabled: AI_AGENT_ENABLED,
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  if (req.method === "POST") {
    const startTime = Date.now();

    try {
      const payload = await req.json();
      const message = extractWhatsAppMessage(payload);

      if (!message?.from) {
        return new Response(
          JSON.stringify({ success: true, ignored: "no_message" }),
          { headers: { "Content-Type": "application/json" } },
        );
      }

      const text = message.body?.trim() ?? "";
      const userPhone = message.from;

      logMarketplaceEvent("MESSAGE_RECEIVED", {
        from: userPhone,
        input: text.slice(0, 100),
        type: message.type,
        hasLocation: !!message.location,
        requestId,
      });

      let responseText: string;

      // Use AI agent if enabled, otherwise fall back to menu-based approach
      if (AI_AGENT_ENABLED) {
        responseText = await handleWithAIAgent(
          userPhone,
          text,
          message,
          requestId,
        );
      } else {
        responseText = await handleWithMenu(userPhone, text, requestId);
      }

      // Send response
      await sendText(userPhone, responseText);

      const duration = Date.now() - startTime;
      logMarketplaceEvent("MESSAGE_PROCESSED", {
        durationMs: duration,
        aiEnabled: AI_AGENT_ENABLED,
        requestId,
      });

      recordMetric("marketplace.message.processed", 1, {
        ai_enabled: String(AI_AGENT_ENABLED),
        duration_ms: duration,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logMarketplaceEvent(
        "ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          durationMs: duration,
          requestId,
        },
        "error",
      );

      recordMetric("marketplace.message.error", 1);

      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("OK");
});

// =====================================================
// AI AGENT HANDLER
// =====================================================

async function handleWithAIAgent(
  userPhone: string,
  text: string,
  message: ReturnType<typeof extractWhatsAppMessage>,
  requestId: string,
): Promise<string> {
  try {
    // Handle special commands that reset context
    const textLower = text.toLowerCase();
    if (
      textLower === "reset" ||
      textLower === "start over" ||
      textLower === "clear"
    ) {
      await MarketplaceAgent.resetContext(userPhone, supabase);
      return (
        "🔄 Let's start fresh!\n\n" +
        "I'm your EasyMO Marketplace assistant. I can help you:\n" +
        "• *Sell* something (just tell me what you want to sell)\n" +
        "• *Find* products, services, or businesses\n" +
        "• *Connect* with buyers and sellers near you\n\n" +
        "What would you like to do?"
      );
    }

    // Show welcome for empty or menu commands
    if (
      !text ||
      textLower === "marketplace" ||
      textLower === "menu" ||
      textLower === "home" ||
      textLower === "help"
    ) {
      // Reset context for fresh start
      await MarketplaceAgent.resetContext(userPhone, supabase);
      return (
        "🛍️ *EasyMO Marketplace*\n\n" +
        "Welcome! I'm your AI assistant for buying and selling in Rwanda.\n\n" +
        "You can:\n" +
        "• Say what you want to *sell* (e.g., \"I want to sell my dining table\")\n" +
        "• Say what you're *looking for* (e.g., \"Looking for a pharmacy nearby\")\n" +
        "• Ask about *businesses* (e.g., \"Where can I find a plumber?\")\n\n" +
        "Just tell me what you need in your own words!"
      );
    }

    // Load conversation context
    const context = await MarketplaceAgent.loadContext(userPhone, supabase);

    // Extract location if provided
    if (message?.location) {
      const location = parseWhatsAppLocation(message.location);
      if (location) {
        context.location = { lat: location.lat, lng: location.lng };
        context.collectedData = {
          ...context.collectedData,
          lat: location.lat,
          lng: location.lng,
          location_text: location.text,
        };
      }
    } else {
      // Try to extract location from text
      const textLocation = parseLocationFromText(text);
      if (textLocation && !context.location) {
        context.location = { lat: textLocation.lat, lng: textLocation.lng };
        context.collectedData = {
          ...context.collectedData,
          location_text: textLocation.text,
        };
      }
    }

    // Process with AI agent
    const agent = new MarketplaceAgent(supabase, undefined, requestId);
    const response = await agent.process(text, context);

    return response.message;
  } catch (error) {
    logMarketplaceEvent(
      "AI_AGENT_ERROR",
      {
        error: error instanceof Error ? error.message : String(error),
        requestId,
      },
      "error",
    );

    // Fallback to basic response
    return (
      "I'm sorry, I'm having trouble understanding right now. " +
      "Please try again or type *menu* to see your options."
    );
  }
}

// =====================================================
// MENU-BASED HANDLER (FALLBACK)
// =====================================================

// In-memory state for menu-based flow
interface UserState {
  mode: "idle" | "browsing" | "search" | "register_business";
  lastAction: string;
  searchQuery?: string;
}

const userStates = new Map<string, UserState>();

async function handleWithMenu(
  userPhone: string,
  text: string,
  _requestId: string,
): Promise<string> {
  const textLower = text.toLowerCase();
  let state = userStates.get(userPhone) || { mode: "idle" as const, lastAction: "" };
  let response = "";

  // Main menu or welcome
  if (
    !text ||
    textLower === "marketplace" ||
    textLower === "shops_services" ||
    textLower === "shop" ||
    textLower === "menu" ||
    textLower === "home"
  ) {
    state = { mode: "idle", lastAction: "menu" };
    response =
      `🛍️ *EasyMO Marketplace*\n\n` +
      `Find local businesses and services in Rwanda.\n\n` +
      `1. 🏪 Browse Businesses\n` +
      `2. 🔍 Search by Category\n` +
      `3. 📍 Nearby Services\n` +
      `4. ➕ Register Your Business\n\n` +
      `Reply with a number or type what you're looking for.`;
  }
  // Browse businesses
  else if (
    textLower === "1" ||
    textLower.includes("browse") ||
    textLower.includes("businesses")
  ) {
    state = { mode: "browsing", lastAction: "browse" };

    const { data: businesses } = await supabase
      .from("business_directory")
      .select("id, name, category, city, phone, rating")
      .neq("status", "DO_NOT_CALL")
      .order("rating", { ascending: false })
      .limit(5);

    if (businesses && businesses.length > 0) {
      response = "🏪 *Featured Businesses*\n\n";
      businesses.forEach((biz, i) => {
        const stars = biz.rating ? "⭐".repeat(Math.round(biz.rating)) : "";
        response += `${i + 1}. *${biz.name}*\n`;
        response += `   📂 ${biz.category}\n`;
        response += `   📍 ${biz.city}\n`;
        if (biz.rating) response += `   ${stars} (${biz.rating})\n`;
        response += `\n`;
      });
      response += `Reply with a number for details and contact info.`;
    } else {
      response =
        "🏪 No businesses found in directory yet.\n\nType *register* to add your business!";
    }
  }
  // Search by category
  else if (
    textLower === "2" ||
    textLower.includes("category") ||
    textLower.includes("categories")
  ) {
    state = { mode: "search", lastAction: "category_prompt" };
    response =
      `🔍 *Search by Category*\n\n` +
      `Popular categories:\n` +
      `• Restaurant 🍽️\n` +
      `• Pharmacy 💊\n` +
      `• Hotel 🏨\n` +
      `• Supermarket 🛒\n` +
      `• Bank 🏦\n` +
      `• Hospital 🏥\n\n` +
      `Type a category to search.`;
  }
  // Nearby services
  else if (
    textLower === "3" ||
    textLower.includes("nearby") ||
    textLower.includes("near me")
  ) {
    state = { mode: "search", lastAction: "nearby" };
    response =
      `📍 *Find Nearby Services*\n\n` +
      `Tell me your location (city or area) and what you need.\n\n` +
      `Example: "pharmacy in Kigali" or "restaurant Nyarugenge"`;
  }
  // Register business
  else if (
    textLower === "4" ||
    textLower.includes("register") ||
    textLower.includes("add business")
  ) {
    state = { mode: "register_business", lastAction: "register_start" };
    response =
      `➕ *Register Your Business*\n\n` +
      `To add your business to our directory, please provide:\n\n` +
      `Business Name, Category, City, Phone\n\n` +
      `Example:\n` +
      `"Kigali Pharmacy, Pharmacy, Kigali, 0788123456"\n\n` +
      `Type *cancel* to go back.`;
  }
  // Cancel
  else if (
    textLower === "cancel" ||
    textLower === "exit" ||
    textLower === "back"
  ) {
    state = { mode: "idle", lastAction: "cancelled" };
    response = "✅ Cancelled. Type *marketplace* to see the main menu.";
  }
  // Handle business registration
  else if (state.mode === "register_business") {
    const parts = text.split(",").map((p) => p.trim());

    if (parts.length >= 3) {
      const name = parts[0];
      const category = parts[1];
      const city = parts[2];
      const phone = parts[3] || userPhone;

      const { data: newBiz, error } = await supabase
        .from("business_directory")
        .insert({
          name,
          category,
          city,
          address: city,
          phone,
          status: "NEW",
          source: "whatsapp_registration",
        })
        .select("id, name, category, city")
        .single();

      if (error) {
        logStructuredEvent(
          "BUSINESS_REGISTER_ERROR",
          { error: error.message },
          "error",
        );
        response =
          "❌ Sorry, there was an error registering your business. Please try again.";
      } else {
        state = { mode: "idle", lastAction: "business_registered" };
        response =
          `✅ *Business Registered!*\n\n` +
          `🏪 ${newBiz.name}\n` +
          `📂 ${newBiz.category}\n` +
          `📍 ${newBiz.city}\n\n` +
          `Your business is now in our directory! Customers can find you by searching.\n\n` +
          `Type *marketplace* to return to menu.`;
      }
    } else {
      response =
        `Please provide details in this format:\n\n` +
        `*Business Name, Category, City, Phone*\n\n` +
        `Example: Kigali Pharmacy, Pharmacy, Kigali, 0788123456`;
    }
  }
  // Handle search mode
  else if (
    state.mode === "search" ||
    textLower.includes(" in ") ||
    textLower.includes(" near ")
  ) {
    const searchQuery = text;

    const { data: results } = await supabase
      .from("business_directory")
      .select("id, name, category, city, phone, rating, address")
      .neq("status", "DO_NOT_CALL")
      .or(
        `name.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`,
      )
      .order("rating", { ascending: false })
      .limit(5);

    if (results && results.length > 0) {
      response = `🔍 *Results for "${searchQuery}"*\n\n`;
      results.forEach((biz, i) => {
        const stars = biz.rating ? "⭐".repeat(Math.round(biz.rating)) : "";
        response += `${i + 1}. *${biz.name}*\n`;
        response += `   📂 ${biz.category}\n`;
        response += `   📍 ${biz.city}\n`;
        if (biz.phone) response += `   📞 ${biz.phone}\n`;
        if (biz.rating) response += `   ${stars}\n`;
        response += `\n`;
      });
      response += `Reply with a number for more details.`;
    } else {
      response = `🔍 No businesses found for "${searchQuery}".\n\nTry browsing with *browse* or search a different category.`;
    }
    state = { mode: "idle", lastAction: "search_complete" };
  }
  // Default handler - treat as search
  else {
    const { data: results } = await supabase
      .from("business_directory")
      .select("id, name, category, city, phone, rating")
      .neq("status", "DO_NOT_CALL")
      .or(
        `name.ilike.%${text}%,category.ilike.%${text}%,city.ilike.%${text}%`,
      )
      .order("rating", { ascending: false })
      .limit(5);

    if (results && results.length > 0) {
      response = `🔍 *Results for "${text}"*\n\n`;
      results.forEach((biz, i) => {
        response += `${i + 1}. *${biz.name}*\n`;
        response += `   📂 ${biz.category} | 📍 ${biz.city}\n`;
        if (biz.phone) response += `   📞 ${biz.phone}\n`;
        response += `\n`;
      });
    } else {
      response = `I didn't find any businesses matching "${text}".\n\nType *marketplace* to see options.`;
    }
  }

  userStates.set(userPhone, state);
  return response;
}


