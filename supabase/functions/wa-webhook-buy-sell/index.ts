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
 * @deprecated This service is deprecated and will be removed in a future release.
 * Marketplace functionality has been migrated to wa-webhook-unified.
 * 
 * Migration Status:
 * - MarketplaceAgent is available in wa-webhook-unified/agents/marketplace-agent.ts
 * - Payment handling available in wa-webhook-unified/tools/
 * - New marketplace features should ONLY be added to wa-webhook-unified
 * - This service remains active for backward compatibility during migration
 * 
 * @see supabase/functions/wa-webhook-unified for the consolidated service
 * @see docs/WA_WEBHOOK_CONSOLIDATION.md for migration guide
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { MarketplaceAgent } from "./agent.ts";
import { handleMediaUpload } from "./media.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import {
  isPaymentCommand,
  handlePaymentCommand,
  showTransactionStatus,
} from "./payment-handler.ts";
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
  // Rate limiting (100 req/min for high-volume WhatsApp)
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: 100,
    windowSeconds: 60,
  });

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!;
  }

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Health check and webhook verification endpoint (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // WhatsApp webhook verification
    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { 
        status: 200,
        headers: { "X-Request-ID": requestId, "X-Correlation-ID": correlationId },
      });
    }

    // Health check (no verification params)
    if (!mode && !token) {
      return respond({
        status: "healthy",
        service: "wa-webhook-marketplace",
        aiEnabled: AI_AGENT_ENABLED,
        timestamp: new Date().toISOString(),
      });
    }

    // Invalid verification attempt
    return respond({ error: "forbidden" }, { status: 403 });
  }

  // Only POST is allowed for webhook messages
  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  const startTime = Date.now();

  try {
      // Read raw body for signature verification
      const rawBody = await req.text();

      // Verify WhatsApp signature (Security requirement per docs/GROUND_RULES.md)
      const signatureHeader = req.headers.has("x-hub-signature-256")
        ? "x-hub-signature-256"
        : req.headers.has("x-hub-signature")
        ? "x-hub-signature"
        : null;
      const signature = signatureHeader ? req.headers.get(signatureHeader) : null;
      const signatureMeta = (() => {
        if (!signature) {
          return {
            provided: false,
            header: signatureHeader,
            method: null as string | null,
            sample: null as string | null,
          };
        }
        const [method, hash] = signature.split("=", 2);
        return {
          provided: true,
          header: signatureHeader,
          method: method?.toLowerCase() ?? null,
          sample: hash ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : null,
        };
      })();
      const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("WA_APP_SECRET");
      const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";
      const internalForward = req.headers.get("x-wa-internal-forward") === "true";

      if (!appSecret) {
        logStructuredEvent("MARKETPLACE_AUTH_CONFIG_ERROR", {
          error: "WHATSAPP_APP_SECRET not configured",
          correlationId,
        }, "error");
        return respond({ error: "server_misconfigured" }, { status: 500 });
      }

      let isValidSignature = false;
      if (signature) {
        try {
          isValidSignature = await verifyWebhookSignature(rawBody, signature, appSecret);
          if (isValidSignature) {
            logStructuredEvent("MARKETPLACE_SIGNATURE_VALID", {
              signatureHeader,
              signatureMethod: signatureMeta.method,
              correlationId,
            });
          }
        } catch (err) {
          logStructuredEvent("MARKETPLACE_SIGNATURE_ERROR", {
            error: err instanceof Error ? err.message : String(err),
            correlationId,
          }, "error");
        }
      }

      if (!isValidSignature) {
        if (allowUnsigned || internalForward) {
          logStructuredEvent("MARKETPLACE_AUTH_BYPASS", {
            reason: internalForward ? "internal_forward" : signature ? "signature_mismatch" : "no_signature",
            signatureHeader,
            signatureMethod: signatureMeta.method,
            signatureSample: signatureMeta.sample,
            userAgent: req.headers.get("user-agent"),
            correlationId,
          }, "warn");
        } else {
          logStructuredEvent("MARKETPLACE_AUTH_FAILED", {
            signatureProvided: signatureMeta.provided,
            signatureHeader,
            signatureMethod: signatureMeta.method,
            signatureSample: signatureMeta.sample,
            userAgent: req.headers.get("user-agent"),
            correlationId,
          }, "warn");
          return respond({ error: "unauthorized" }, { status: 401 });
        }
      }

      // Parse payload after verification
      const payload = JSON.parse(rawBody);
      const message = extractWhatsAppMessage(payload);

      if (!message?.from) {
        return respond({ success: true, ignored: "no_message" });
      }

      const text = String(message.body ?? "").trim();
      const userPhone = message.from;

      logMarketplaceEvent("MESSAGE_RECEIVED", {
        from: userPhone,
        input: typeof text === 'string' ? text.slice(0, 100) : String(text).slice(0, 100),
        type: message.type,
        hasLocation: !!message.location,
        requestId,
      });

      let responseText: string;

      // Check for category selection (interactive list response)
      if (message.type === "interactive" && message.interactive?.list_reply?.id) {
        const selectedId = message.interactive.list_reply.id;
        
        // Handle category selection
        if (selectedId.startsWith("category_")) {
          const { handleCategorySelection } = await import("./handle_category.ts");
          await handleCategorySelection(userPhone, selectedId);
          
          // Return empty to skip sending additional text
          return respond({ success: true, message: "category_selection_sent" });
        }
        
        // Handle "Chat with AI" option
        if (selectedId === "chat_with_ai") {
          responseText = "💬 *Chat Mode Activated*\n\nAsk me anything about products or services you're looking for!";
        }
      }
      
      // Check for button replies (pagination)
      if (message.type === "interactive" && message.interactive?.button_reply?.id) {
        const buttonId = message.interactive.button_reply.id;
        
        // Handle "Show More" button
        if (buttonId === "buy_sell_show_more") {
          const { handleShowMore } = await import("./handle_pagination.ts");
          await handleShowMore(userPhone);
          return respond({ success: true, message: "show_more_processed" });
        }
        
        // Handle "New Search" button
        if (buttonId === "buy_sell_new_search") {
          const { handleNewSearch } = await import("./handle_pagination.ts");
          await handleNewSearch(userPhone);
          return respond({ success: true, message: "new_search_requested" });
        }
      }
      
      // Handle location sharing
      else if (message.type === "location" && message.location) {
        const { handleLocationShared } = await import("./handle_category.ts");
        await handleLocationShared(
          userPhone,
          message.location.latitude,
          message.location.longitude
        );
        
        // Return empty to skip sending additional text
        return respond({ success: true, message: "location_processed" });
      }
      
      // Handle media uploads (photos, documents)
      if (message.type === "image" || message.type === "document") {
        if (AI_AGENT_ENABLED) {
          const context = await MarketplaceAgent.loadContext(userPhone, supabase);
          responseText = await handleMediaUpload(
            userPhone,
            message,
            context,
            supabase
          );
        } else {
          responseText = "📸 Photo uploads are only available when using the AI assistant. Please enable AI mode.";
        }
      }
      // ALL flows now go through the Hybrid Menu handler
      responseText = await handleWithMenu(userPhone, text, message, requestId);

      // Send response only if there's actual text (empty means interactive already sent)
      if (responseText && responseText.trim()) {
        await sendText(userPhone, responseText);
      }

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

      return respond({ success: true });
    } catch (error) {
      const duration = Date.now() - startTime;
      logMarketplaceEvent(
        "ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          durationMs: duration,
          requestId,
          correlationId,
        },
        "error",
      );

      recordMetric("marketplace.message.error", 1);

      return respond({ error: String(error) }, { status: 500 });
    }
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
    // Check for payment commands first
    if (isPaymentCommand(text)) {
      const paymentResponse = await handlePaymentCommand({
        phone: userPhone,
        text,
        supabase,
      });
      
      if (paymentResponse) {
        return paymentResponse;
      }
    }

    // Check for transaction status request
    const textLower = text.toLowerCase();
    if (textLower === "my transactions" || textLower === "status" || textLower === "transaction status") {
      return await showTransactionStatus(userPhone, supabase);
    }

    // Handle special commands that reset context
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
        "• *Connect* with buyers and sellers near you\n" +
        "• *Track* transactions (reply 'STATUS')\n\n" +
        "What would you like to do?"
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
        
        // Save to cache for future use (30-minute TTL)
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("whatsapp_e164", userPhone)
            .single();
          
          if (profile?.user_id) {
            await supabase.rpc("update_user_location_cache", {
              _user_id: profile.user_id,
              _lat: location.lat,
              _lng: location.lng,
            });
            logMarketplaceEvent("LOCATION_CACHED", { userPhone }, "info");
          }
        } catch (cacheError) {
          // Non-critical - log but continue
          await logStructuredEvent("WARNING", { data: "marketplace.location_cache_fail", cacheError });
        }
      }
    } else if (!context.location) {
      // Try location resolution: cache → saved → prompt
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("whatsapp_e164", userPhone)
          .single();
        
        if (profile?.user_id) {
          // 1. Try cached location (30-min TTL)
          const { data: cached } = await supabase.rpc("get_cached_location", {
            _user_id: profile.user_id,
            _cache_minutes: 30,
          });
          
          if (cached && cached.length > 0 && cached[0].is_valid) {
            context.location = { lat: cached[0].lat, lng: cached[0].lng };
            context.collectedData = {
              ...context.collectedData,
              lat: cached[0].lat,
              lng: cached[0].lng,
              location_text: "Cached location",
            };
            logMarketplaceEvent("LOCATION_FROM_CACHE", { userPhone }, "info");
          } 
          // 2. Try saved home location
          else {
            const { data: savedLoc } = await supabase
              .from('saved_locations')
              .select('lat, lng, label')
              .eq('user_id', profile.user_id)
              .eq('label', 'home')
              .single();
            
            if (savedLoc?.lat && savedLoc?.lng) {
              context.location = { lat: savedLoc.lat, lng: savedLoc.lng };
              context.collectedData = {
                ...context.collectedData,
                lat: savedLoc.lat,
                lng: savedLoc.lng,
                location_text: `${savedLoc.label} location`,
              };
              logMarketplaceEvent("LOCATION_FROM_SAVED", { 
                userPhone, 
                label: savedLoc.label 
              }, "info");
            }
          }
        }
      } catch (cacheError) {
        // Non-critical - continue without cached location
        await logStructuredEvent("WARNING", { data: "marketplace.location_resolution_fail", cacheError });
      }
      
      // If still no location, try to extract from text
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
    // If interactive list was sent, return empty to skip text message
    if (error instanceof Error && error.message === "INTERACTIVE_LIST_SENT") {
      return ""; // Interactive list already sent, don't send text
    }
    
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
// HYBRID HANDLER (MENU + CHAT)
// =====================================================

import { getCountryCode } from "../_shared/phone-utils.ts";

// Top 9 Categories (Excluding Banks, Restaurants, Hotels)
const TOP_CATEGORIES = [
  { id: "1", name: "Pharmacies", icon: "💊", key: "pharmacy" },
  { id: "2", name: "Schools", icon: "📚", key: "school" },
  { id: "3", name: "Cosmetics", icon: "💄", key: "cosmetics" },
  { id: "4", name: "Notaries", icon: "⚖️", key: "notary" },
  { id: "5", name: "Electronics", icon: "📱", key: "electronics" },
  { id: "6", name: "Hardware", icon: "🔨", key: "hardware" },
  { id: "7", name: "Mechanics", icon: "🔧", key: "mechanic" },
  { id: "8", name: "Salons", icon: "💇‍♀️", key: "salon" },
  { id: "9", name: "Bakeries", icon: "🥖", key: "bakery" },
];

interface UserState {
  mode: "idle" | "awaiting_location" | "register_business";
  selectedCategory?: string;
  lastAction?: string;
}

const userStates = new Map<string, UserState>();

function getCountryName(phone: string): string {
  const code = getCountryCode(phone);
  if (code === "250") return "Rwanda";
  if (code === "356") return "Malta";
  return "Rwanda"; // Default
}

function createMockMessage(from: string, body: string) {
    return {
        from,
        body,
        type: "text",
        messageId: "mock-" + Date.now(),
        data: null,
        name: "User",
        timestamp: Date.now(),
    };
}

async function handleWithMenu(
  userPhone: string,
  text: string,
  message: ReturnType<typeof extractWhatsAppMessage>,
  requestId: string,
): Promise<string> {
  const textLower = text.toLowerCase();
  let state = userStates.get(userPhone) || { mode: "idle" };
  let response = "";
  const country = getCountryName(userPhone);

  // 1. MAIN MENU / IDLE
  if (
    (!text && !message?.location) ||
    textLower === "marketplace" ||
    textLower === "buy" ||
    textLower === "sell" ||
    textLower === "menu" ||
    textLower === "home"
  ) {
    state = { mode: "idle" };
    response = `🛍️ *Buy & Sell (${country})*\n\n` +
      `Pick a category to find nearby businesses, or just chat with me!\n\n`;

    TOP_CATEGORIES.forEach((cat) => {
      response += `${cat.id}. ${cat.icon} ${cat.name}\n`;
    });

    response += `\nType a number, or tell me what you're looking for!`;
  }
  // 2. CATEGORY SELECTION
  else if (state.mode === "idle" && /^[1-9]$/.test(text.trim())) {
    const selection = TOP_CATEGORIES.find((c) => c.id === text.trim());
    if (selection) {
      state = { mode: "awaiting_location", selectedCategory: selection.key };
      response = `📍 Finding *${selection.name}* nearby.\n\n` +
        `Please share your location (send location attachment) or type your city/neighborhood.`;
    } else {
      // Pass through to AI if not a valid number
      return await handleWithAIAgent(userPhone, text, message, requestId);
    }
  }
  // 3. LOCATION PROVIDED (for Category Search)
  else if (state.mode === "awaiting_location") {
    // Handle Location Attachment OR Text
    let locationQuery = text;
    let lat: number | undefined;
    let lng: number | undefined;

    if (message?.location) {
      const parsedLoc = parseWhatsAppLocation(message.location);
      if (parsedLoc) {
        lat = parsedLoc.lat;
        lng = parsedLoc.lng;
        locationQuery = parsedLoc.text || "Current Location";
      }
    }

    const category = state.selectedCategory;

    // Build the query
    let query = supabase
      .from("businesses")
      .select("*") 
      .ilike("category", `%${category}%`)
      .eq("country", country)
      .eq("status", "active")
      .order("rating", { ascending: false })
      .limit(5);

    // If we have precise coordinates, use rpc for distance sorting (if available) or just simple query
    // For now, to keep it simple and robust without assuming PostGIS extensions are perfect, we'll try text search if no lat/lng.
    
    if (!lat && !lng) {
      query = query.or(`city.ilike.%${locationQuery}%,address.ilike.%${locationQuery}%`);
    } else {
      // Logic for lat/lng could be added here if we had the RPC ready. 
      // For now, we'll fallback to loose matching or just return top rated in country if specific location query is missing/ambiguous
    }

    const { data: results } = await query;

    if (results && results.length > 0) {
      response = `🏪 *Nearby ${state.selectedCategory} in ${country}*\n\n`;
      results.forEach((biz: any, i: number) => {
        const stars = biz.rating ? "⭐".repeat(Math.round(biz.rating)) : "";
        response += `${i + 1}. *${biz.name}*\n`;
        response += `   📍 ${biz.city || biz.address || "Unknown Location"}\n`;
        if (biz.phone) {
          const cleanPhone = biz.phone.replace(/\D/g, "");
          response += `   💬 https://wa.me/${cleanPhone}\n`;
        }
        if (stars) response += `   ${stars}\n`;
        response += `\n`;
      });
      response += `Type *menu* to go back.`;
    } else {
      response = `😕 No ${category} found near "${locationQuery}" (${country}).\n\n` +
                 `Try a different location or type *chat* to ask the AI agent.`;
    }
    state = { mode: "idle" }; // Reset after search
  }
  // 4. FALLBACK TO AI AGENT (Chat Mode)
  else {
    // If it's not a menu command, let the AI handle it
    return await handleWithAIAgent(userPhone, text, message, requestId);
  }

  userStates.set(userPhone, state);
  return response;
}
