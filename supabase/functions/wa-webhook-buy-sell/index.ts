/**
 * Marketplace AI Agent Webhook Handler
 *
 * Natural language AI agent for connecting buyers and sellers in Rwanda via WhatsApp.
 * Features:
 * - Interactive category-based workflow with 9 business types
 * - Conversational selling flow (create listings)
 * - Conversational buying flow (search and match)
 * - Proximity-based matching
 * - Integration with business directory
 *
 * Workflow:
 * 1. User sends message → Agent responds with 9 emoji-numbered category options
 * 2. User types a number (e.g., 4) → Agent asks user to share location
 * 3. System filters database by user location → Returns top 9 nearest businesses
 * 4. User can select one to chat with seller/vendor
 *
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { 
  MarketplaceAgent, 
  generateCategoryMenu,
  parseCategorySelection,
  getCategoryByNumber,
  generateLocationRequest,
  formatBusinessResults,
  formatBusinessContact,
  parseResultSelection,
  BUSINESS_CATEGORIES,
  type MarketplaceContext,
} from "./agent.ts";
import { handleMediaUpload, ensureStorageBucket } from "./media.ts";
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

// Feature flag for AI agent (defaults to false, use interactive workflow)
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

      // Handle WhatsApp location messages (for interactive flow)
      if (message.type === "location" && message.location) {
        const location = parseWhatsAppLocation(message.location);
        if (location) {
          responseText = await handleLocationMessage(
            userPhone,
            location,
            requestId,
          );
        } else {
          responseText = "📍 Could not process your location. Please try again or type a city name like 'Kigali'.";
        }
      }
      // Handle media uploads (photos, documents)
      else if (message.type === "image" || message.type === "document") {
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
      // Use AI agent if enabled, otherwise fall back to menu-based approach
      else if (AI_AGENT_ENABLED) {
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
// USER FLOW STATE MANAGEMENT
// =====================================================

interface UserFlowState {
  mode: "idle" | "category_menu" | "awaiting_location" | "show_results" | "show_contact" | "register_business" | "selling";
  lastAction: string;
  selectedCategory?: typeof BUSINESS_CATEGORIES[number];
  searchResults?: Array<Record<string, unknown>>;
  selectedBusiness?: Record<string, unknown>;
  location?: { lat: number; lng: number };
}

const userFlowStates = new Map<string, UserFlowState>();

// =====================================================
// LOCATION MESSAGE HANDLER
// =====================================================

/**
 * Handle WhatsApp location messages for the interactive flow
 */
async function handleLocationMessage(
  userPhone: string,
  location: { lat: number; lng: number; text?: string },
  requestId: string,
): Promise<string> {
  // Get user's flow state
  const state = userFlowStates.get(userPhone);
  
  logMarketplaceEvent("LOCATION_RECEIVED", {
    from: userPhone,
    lat: location.lat,
    lng: location.lng,
    mode: state?.mode,
    requestId,
  });
  
  // If user is awaiting location and has selected a category
  if (state?.mode === "awaiting_location" && state.selectedCategory) {
    // Search for businesses near user's location
    const { data: businesses, error } = await supabase.rpc(
      "search_businesses_nearby",
      {
        search_term: state.selectedCategory.code,
        user_lat: location.lat,
        user_lng: location.lng,
        radius_km: 15,
        result_limit: 9,
      }
    );

    // Fallback to basic search if RPC fails
    let results = businesses;
    if (error || !results || results.length === 0) {
      logMarketplaceEvent("LOCATION_SEARCH_RPC_FALLBACK", {
        error: error?.message,
        category: state.selectedCategory.code,
        requestId,
      }, "warn");
      
      const { data: fallbackResults } = await supabase
        .from("business_directory")
        .select("id, name, category, city, address, phone, rating")
        .or(`category.ilike.%${state.selectedCategory.code}%,category.ilike.%${state.selectedCategory.name}%`)
        .neq("status", "DO_NOT_CALL")
        .order("rating", { ascending: false, nullsFirst: false })
        .limit(9);
      
      results = fallbackResults || [];
    }

    // Update state with results
    const updatedState = { 
      ...state, 
      mode: "show_results" as const, 
      lastAction: "location_search_complete",
      searchResults: results,
      location: { lat: location.lat, lng: location.lng },
    };
    userFlowStates.set(userPhone, updatedState);
    
    logMarketplaceEvent("LOCATION_SEARCH_COMPLETE", {
      from: userPhone,
      category: state.selectedCategory.code,
      resultCount: results?.length || 0,
      requestId,
    });

    return formatBusinessResults(results || [], state.selectedCategory);
  }
  
  // If no category selected, show category menu first
  const newState = { 
    mode: "category_menu" as const, 
    lastAction: "location_received_no_category",
    location: { lat: location.lat, lng: location.lng },
  };
  userFlowStates.set(userPhone, newState);
  
  return (
    `📍 *Location Received!*\n\n` +
    `Great, I have your location. Now select what you're looking for:\n\n` +
    generateCategoryMenu().split("\n\n").slice(1).join("\n\n")
  );
}

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
        "• Ask about *businesses* (e.g., \"Where can I find a plumber?\")\n" +
        "• Check *transaction status* (reply 'STATUS')\n\n" +
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
// INTERACTIVE WORKFLOW HANDLER
// =====================================================

async function handleWithMenu(
  userPhone: string,
  text: string,
  requestId: string,
): Promise<string> {
  const textLower = text.toLowerCase().trim();
  let state = userFlowStates.get(userPhone) || { mode: "idle" as const, lastAction: "" };
  let response = "";

  logMarketplaceEvent("INTERACTIVE_FLOW_INPUT", {
    from: userPhone,
    mode: state.mode,
    input: textLower.slice(0, 50),
    requestId,
  });

  // =====================================================
  // STEP 1: Main menu / Category selection
  // =====================================================
  if (
    !text ||
    textLower === "marketplace" ||
    textLower === "shops_services" ||
    textLower === "buy_and_sell" ||
    textLower === "shop" ||
    textLower === "menu" ||
    textLower === "home" ||
    textLower === "start" ||
    textLower === "hi" ||
    textLower === "hello"
  ) {
    state = { mode: "category_menu", lastAction: "show_menu" };
    response = generateCategoryMenu();
  }

  // =====================================================
  // STEP 2: Category selected → Ask for location
  // =====================================================
  else if (state.mode === "category_menu" || state.mode === "idle") {
    const categoryNum = parseCategorySelection(textLower);
    
    if (categoryNum) {
      const category = getCategoryByNumber(categoryNum);
      if (category) {
        state = { 
          mode: "awaiting_location", 
          lastAction: "category_selected",
          selectedCategory: category,
        };
        response = generateLocationRequest(category);
        
        logMarketplaceEvent("CATEGORY_SELECTED", {
          from: userPhone,
          category: category.code,
          categoryName: category.name,
          requestId,
        });
      } else {
        response = generateCategoryMenu();
      }
    } else {
      // Try to match category from natural language
      const matchedCategory = BUSINESS_CATEGORIES.find(cat => 
        textLower.includes(cat.code) || 
        textLower.includes(cat.name.toLowerCase()) ||
        cat.description.toLowerCase().split(" ").some(w => textLower.includes(w) && w.length > 4)
      );
      
      if (matchedCategory) {
        state = { 
          mode: "awaiting_location", 
          lastAction: "category_selected",
          selectedCategory: matchedCategory,
        };
        response = generateLocationRequest(matchedCategory);
      } else {
        // Show menu with hint
        state = { mode: "category_menu", lastAction: "show_menu" };
        response = generateCategoryMenu();
      }
    }
  }

  // =====================================================
  // STEP 3: Location received → Search and show results
  // =====================================================
  else if (state.mode === "awaiting_location") {
    // Try to parse location from text
    const textLocation = parseLocationFromText(textLower);
    let lat: number | null = null;
    let lng: number | null = null;
    
    if (textLocation) {
      lat = textLocation.lat;
      lng = textLocation.lng;
    } else {
      // Default to Kigali center if no location recognized
      // User should share actual location for better results
      lat = -1.9403;
      lng = 30.0588;
    }
    
    if (lat !== null && lng !== null && state.selectedCategory) {
      // Search for businesses near user's location
      const { data: businesses, error } = await supabase.rpc(
        "search_businesses_nearby",
        {
          search_term: state.selectedCategory.code,
          user_lat: lat,
          user_lng: lng,
          radius_km: 15,
          result_limit: 9,
        }
      );

      // Fallback to basic search if RPC fails
      let results = businesses;
      if (error || !results || results.length === 0) {
        logMarketplaceEvent("RPC_FALLBACK", {
          error: error?.message,
          category: state.selectedCategory.code,
          requestId,
        }, "warn");
        
        const { data: fallbackResults } = await supabase
          .from("business_directory")
          .select("id, name, category, city, address, phone, rating")
          .or(`category.ilike.%${state.selectedCategory.code}%,category.ilike.%${state.selectedCategory.name}%`)
          .neq("status", "DO_NOT_CALL")
          .order("rating", { ascending: false, nullsFirst: false })
          .limit(9);
        
        results = fallbackResults || [];
      }

      state = { 
        ...state, 
        mode: "show_results", 
        lastAction: "search_complete",
        searchResults: results,
        location: { lat, lng },
      };
      
      response = formatBusinessResults(results || [], state.selectedCategory);
      
      logMarketplaceEvent("SEARCH_COMPLETE", {
        from: userPhone,
        category: state.selectedCategory.code,
        resultCount: results?.length || 0,
        requestId,
      });
    } else {
      // Could not get location, ask again
      response = 
        `📍 *I didn't recognize that location*\n\n` +
        `Please try:\n` +
        `• Sharing your location using the 📎 button\n` +
        `• Typing a city name like "Kigali" or "Musanze"\n\n` +
        `_Or type *menu* to choose a different category_`;
    }
  }

  // =====================================================
  // STEP 4: Result selected → Show contact details
  // =====================================================
  else if (state.mode === "show_results" && state.searchResults) {
    const resultNum = parseResultSelection(textLower);
    
    // Check if user wants to call the selected business
    if (textLower === "call" && state.selectedBusiness) {
      const phone = state.selectedBusiness.phone as string;
      if (phone) {
        response = 
          `📞 *Contact Information*\n\n` +
          `*${state.selectedBusiness.name}*\n` +
          `Phone: ${phone}\n\n` +
          `You can call or WhatsApp this number directly.\n\n` +
          `🔄 _Type *menu* to search for more businesses_`;
      } else {
        response = 
          `😔 Sorry, no phone number is available for this business.\n\n` +
          `🔄 _Type *menu* to search for more businesses_`;
      }
    }
    else if (resultNum && resultNum <= state.searchResults.length) {
      const selectedBiz = state.searchResults[resultNum - 1];
      state = {
        ...state,
        mode: "show_contact",
        lastAction: "business_selected",
        selectedBusiness: selectedBiz,
      };
      response = formatBusinessContact(selectedBiz as {
        name: string;
        category?: string;
        city?: string;
        address?: string;
        phone?: string;
        rating?: number;
        distance_km?: number;
        description?: string;
      });
      
      logMarketplaceEvent("BUSINESS_SELECTED", {
        from: userPhone,
        businessId: selectedBiz.id,
        businessName: selectedBiz.name,
        requestId,
      });
    } else {
      // Invalid selection, show results again
      response = formatBusinessResults(
        state.searchResults as Array<{
          id?: string;
          name: string;
          category?: string;
          city?: string;
          address?: string;
          phone?: string;
          rating?: number;
          distance_km?: number;
        }>,
        state.selectedCategory!
      );
    }
  }

  // =====================================================
  // STEP 5: Contact shown → Handle call or back to menu
  // =====================================================
  else if (state.mode === "show_contact" && state.selectedBusiness) {
    if (textLower === "call") {
      const phone = state.selectedBusiness.phone as string;
      if (phone) {
        response = 
          `📞 *Contact Information*\n\n` +
          `*${state.selectedBusiness.name}*\n` +
          `Phone: ${phone}\n\n` +
          `You can call or WhatsApp this number directly.\n\n` +
          `🔄 _Type *menu* to search for more businesses_`;
        
        recordMetric("marketplace.contact.revealed", 1, {
          category: state.selectedCategory?.code ?? "unknown",
        });
      } else {
        response = 
          `😔 Sorry, no phone number is available for this business.\n\n` +
          `🔄 _Type *menu* to search for more businesses_`;
      }
    } else {
      // Go back to menu
      state = { mode: "category_menu", lastAction: "show_menu" };
      response = generateCategoryMenu();
    }
  }

  // =====================================================
  // Handle special commands
  // =====================================================
  else if (
    textLower === "cancel" ||
    textLower === "exit" ||
    textLower === "back"
  ) {
    state = { mode: "category_menu", lastAction: "cancelled" };
    response = generateCategoryMenu();
  }

  // =====================================================
  // Handle sell/register business
  // =====================================================
  else if (
    textLower === "sell" ||
    textLower === "register" ||
    textLower === "add business" ||
    textLower.includes("i want to sell") ||
    textLower.includes("list my")
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
        state = { mode: "category_menu", lastAction: "business_registered" };
        response =
          `✅ *Business Registered!*\n\n` +
          `🏪 ${newBiz.name}\n` +
          `📂 ${newBiz.category}\n` +
          `📍 ${newBiz.city}\n\n` +
          `Your business is now in our directory! Customers can find you by searching.\n\n` +
          `Type *menu* to continue.`;
        
        recordMetric("marketplace.business.registered", 1, {
          category: category,
        });
      }
    } else {
      response =
        `Please provide details in this format:\n\n` +
        `*Business Name, Category, City, Phone*\n\n` +
        `Example: Kigali Pharmacy, Pharmacy, Kigali, 0788123456`;
    }
  }

  // =====================================================
  // Default: show category menu
  // =====================================================
  else {
    state = { mode: "category_menu", lastAction: "show_menu" };
    response = generateCategoryMenu();
  }

  userFlowStates.set(userPhone, state);
  return response;
}


