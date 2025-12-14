/**
 * WhatsApp Buy & Sell - Pure AI Agent Conversation
 *
 * SINGLE RESPONSIBILITY: AI-powered conversational marketplace assistant
 * 
 * Scope:
 * - Welcome new users with AI agent introduction
 * - Pass all messages to AI agent for natural language processing
 * - Handle location sharing for nearby business search
 * - Manage user's business listings (My Businesses)
 * - WhatsApp deep links (wa.me/{phone})
 * 
 * Flow:
 * 1. User taps "Buy and Sell" → AI welcomes them
 * 2. User sends any message → AI agent handles it
 * 3. AI can search businesses, create listings, handle inquiries conversationally
 * 4. No structured category workflow - pure natural language
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { claimEvent } from "../_shared/wa-webhook-shared/state/idempotency.ts";
import { extractWhatsAppMessage } from "./utils/index.ts";
import { MarketplaceAgent, WELCOME_MESSAGE } from "./core/agent.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

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
    headers.set("X-Service", "wa-webhook-buy-sell");
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
      const health = await MarketplaceAgent.healthCheck();
      
      return respond({
        status: "healthy",
        service: "wa-webhook-buy-sell",
        scope: "ai_agent_conversation",
        aiProvider: health.aiProvider,
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
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("WA_APP_SECRET");
    const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";
    const internalForward = req.headers.get("x-wa-internal-forward") === "true";

    if (!appSecret) {
      logStructuredEvent("BUY_SELL_DIR_AUTH_CONFIG_ERROR", {
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
          logStructuredEvent("BUY_SELL_DIR_SIGNATURE_VALID", {
            signatureHeader,
            correlationId,
          });
        }
      } catch (err) {
        logStructuredEvent("BUY_SELL_DIR_SIGNATURE_ERROR", {
          error: err instanceof Error ? err.message : String(err),
          correlationId,
        }, "error");
      }
    }

    if (!isValidSignature) {
      if (allowUnsigned || internalForward) {
        logStructuredEvent("BUY_SELL_DIR_AUTH_BYPASS", {
          reason: internalForward ? "internal_forward" : signature ? "signature_mismatch" : "no_signature",
          correlationId,
        }, "warn");
      } else {
        logStructuredEvent("BUY_SELL_DIR_AUTH_FAILED", {
          signatureProvided: !!signature,
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

    // CRITICAL: Deduplicate messages using message_id to prevent spam
    const messageId = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
    if (messageId) {
      const claimed = await claimEvent(messageId);
      if (!claimed) {
        await logStructuredEvent("BUY_SELL_DIR_DUPLICATE_BLOCKED", {
          message_id: messageId,
          from: `***${userPhone.slice(-4)}`,
          correlationId,
        });
        return respond({ success: true, message: "duplicate_blocked" });
      }
    }

    logStructuredEvent("BUY_SELL_MESSAGE_RECEIVED", {
      from: userPhone,
      type: message.type,
      hasLocation: !!message.location,
      requestId,
    });

    // === INTERACTIVE HANDLERS ===

    // Button replies (common actions + My Business management)
    if (message.type === "interactive" && message.interactive?.button_reply?.id) {
      const buttonId = message.interactive.button_reply.id;

      // Handle Share easyMO button (auto-appended by reply.ts)
      if (buttonId === "share_easymo") {
        const { handleShareEasyMOButton } = await import("../_shared/wa-webhook-shared/utils/share-button-handler.ts");
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, language")
          .eq("whatsapp_number", userPhone)
          .single();
        
        if (profile?.user_id) {
          await handleShareEasyMOButton({
            from: userPhone,
            profileId: profile.user_id,
            locale: (profile.language || "en") as any,
            supabase,
          }, "wa-webhook-buy-sell");
        }
        return respond({ success: true, message: "share_button_handled" });
      }

      // === MY BUSINESSES MANAGEMENT ===
      
      // List user's businesses
      if (buttonId === "MY_BUSINESSES" || buttonId === "my_business") {
        const { listMyBusinesses } = await import("./my-business/list.ts");
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, language")
          .eq("whatsapp_number", userPhone)
          .single();
        
        if (profile) {
          const ctx = {
            supabase,
            from: userPhone,
            profileId: profile.user_id,
            locale: (profile.language || "en") as any,
          };
          await listMyBusinesses(ctx);
        }
        return respond({ success: true, message: "my_businesses_shown" });
      }

      // Create business
      if (buttonId === "CREATE_BUSINESS") {
        const { startCreateBusiness } = await import("./my-business/list.ts");
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, language")
          .eq("whatsapp_number", userPhone)
          .single();
        
        if (profile) {
          const ctx = {
            supabase,
            from: userPhone,
            profileId: profile.user_id,
            locale: (profile.language || "en") as any,
          };
          await startCreateBusiness(ctx);
        }
        return respond({ success: true, message: "create_business_started" });
      }

      // Business selection
      if (buttonId.startsWith("BIZ::")) {
        const businessId = buttonId.replace("BIZ::", "");
        const { handleBusinessSelection } = await import("./my-business/list.ts");
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, language")
          .eq("whatsapp_number", userPhone)
          .single();
        
        if (profile) {
          const ctx = {
            supabase,
            from: userPhone,
            profileId: profile.user_id,
            locale: (profile.language || "en") as any,
          };
          await handleBusinessSelection(ctx, businessId);
        }
        return respond({ success: true, message: "business_selected" });
      }

      // Edit business
      if (buttonId.startsWith("EDIT_BIZ::")) {
        const businessId = buttonId.replace("EDIT_BIZ::", "");
        const { startEditBusiness } = await import("./my-business/update.ts");
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, language")
          .eq("whatsapp_number", userPhone)
          .single();
        
        if (profile) {
          const ctx = {
            supabase,
            from: userPhone,
            profileId: profile.user_id,
            locale: (profile.language || "en") as any,
          };
          await startEditBusiness(ctx, businessId);
        }
        return respond({ success: true, message: "edit_business_started" });
      }

      // Delete business (confirmation)
      if (buttonId.startsWith("DELETE_BIZ::")) {
        const businessId = buttonId.replace("DELETE_BIZ::", "");
        const { confirmDeleteBusiness } = await import("./my-business/delete.ts");
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, language")
          .eq("whatsapp_number", userPhone)
          .single();
        
        if (profile) {
          const ctx = {
            supabase,
            from: userPhone,
            profileId: profile.user_id,
            locale: (profile.language || "en") as any,
          };
          await confirmDeleteBusiness(ctx, businessId);
        }
        return respond({ success: true, message: "delete_confirmation_shown" });
      }

      // Confirm delete
      if (buttonId.startsWith("CONFIRM_DELETE_BIZ::")) {
        const businessId = buttonId.replace("CONFIRM_DELETE_BIZ::", "");
        const { handleDeleteBusiness } = await import("./my-business/delete.ts");
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, language")
          .eq("whatsapp_number", userPhone)
          .single();
        
        if (profile) {
          const ctx = {
            supabase,
            from: userPhone,
            profileId: profile.user_id,
            locale: (profile.language || "en") as any,
          };
          await handleDeleteBusiness(ctx, businessId);
        }
        return respond({ success: true, message: "business_deleted" });
      }

      // Other business actions
      if (buttonId.startsWith("EDIT_BIZ_NAME::") || buttonId.startsWith("EDIT_BIZ_DESC::") || buttonId.startsWith("BACK_BIZ::")) {
        const businessId = buttonId.replace(/^(EDIT_BIZ_NAME|EDIT_BIZ_DESC|BACK_BIZ)::/, "");
        const action = buttonId.split("::")[0];
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, language")
          .eq("whatsapp_number", userPhone)
          .single();
        
        if (profile) {
          const ctx = {
            supabase,
            from: userPhone,
            profileId: profile.user_id,
            locale: (profile.language || "en") as any,
          };

          if (action === "EDIT_BIZ_NAME" || action === "EDIT_BIZ_DESC") {
            const { promptEditField } = await import("./my-business/update.ts");
            const field = action === "EDIT_BIZ_NAME" ? "name" : "description";
            await promptEditField(ctx, businessId, field);
          } else if (action === "BACK_BIZ") {
            const { handleBusinessSelection } = await import("./my-business/list.ts");
            await handleBusinessSelection(ctx, businessId);
          }
        }
        return respond({ success: true, message: "business_action_handled" });
      }
    }

    // === LOCATION HANDLER ===

    // Location sharing - pass to AI agent with location context
    if (message.type === "location" && message.location) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, language")
        .eq("whatsapp_number", userPhone)
        .maybeSingle();

      if (profile) {
        // Load or create context with location
        const context: BuyAndSellContext = await MarketplaceAgent.loadContext(userPhone, supabase);
        context.location = {
          lat: message.location.latitude,
          lng: message.location.longitude,
        };
        
        // Process location with agent
        const agent = new MarketplaceAgent(supabase, correlationId);
        const response = await agent.process("I shared my location", context);
        
        await sendText(userPhone, response.message);
        return respond({ success: true, message: "location_processed_by_agent" });
      }
    }

    // === TEXT HANDLERS ===

    // Business state handlers
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, language")
      .eq("whatsapp_number", userPhone)
      .maybeSingle();

    if (profile) {
      const { getState } = await import("../_shared/wa-webhook-shared/state/store.ts");
      const state = await getState(supabase, profile.user_id);

      // Business creation - name input
      if (state?.key === "business_create_name") {
        const { handleCreateBusinessName } = await import("./my-business/create.ts");
        const ctx = {
          supabase,
          from: userPhone,
          profileId: profile.user_id,
          locale: (profile.language || "en") as any,
        };
        await handleCreateBusinessName(ctx, text);
        return respond({ success: true, message: "business_name_processed" });
      }

      // Business edit - name field
      if (state?.key === "business_edit_name" && state.data) {
        const { handleUpdateBusinessField } = await import("./my-business/update.ts");
        const ctx = {
          supabase,
          from: userPhone,
          profileId: profile.user_id,
          locale: (profile.language || "en") as any,
        };
        await handleUpdateBusinessField(ctx, String(state.data.businessId), "name", text);
        return respond({ success: true, message: "business_name_updated" });
      }

      // Business edit - description field
      if (state?.key === "business_edit_description" && state.data) {
        const { handleUpdateBusinessField } = await import("./my-business/update.ts");
        const ctx = {
          supabase,
          from: userPhone,
          profileId: profile.user_id,
          locale: (profile.language || "en") as any,
        };
        await handleUpdateBusinessField(ctx, String(state.data.businessId), "description", text);
        return respond({ success: true, message: "business_description_updated" });
      }

      // Business search - name input
      if (state?.key === "business_search" && state.data?.step === "awaiting_name") {
        const { handleBusinessNameSearch } = await import("./my-business/search.ts");
        const ctx = {
          supabase,
          from: userPhone,
          profileId: profile.user_id,
          locale: (profile.language || "en") as any,
        };
        await handleBusinessNameSearch(ctx, text);
        return respond({ success: true, message: "business_search_processed" });
      }

      // Manual business add - step-by-step
      if (state?.key === "business_add_manual" && state.data) {
        const { handleManualBusinessStep } = await import("./my-business/add_manual.ts");
        const ctx = {
          supabase,
          from: userPhone,
          profileId: profile.user_id,
          locale: (profile.language || "en") as any,
        };
        await handleManualBusinessStep(ctx, state.data, text);
        return respond({ success: true, message: "manual_business_step_processed" });
      }
    }

    // === AI AGENT PROCESSING ===
    
    // Home/menu/reset commands → show welcome message and reset context
    const lower = text.toLowerCase();
    if (
      !text ||
      lower === "menu" ||
      lower === "home" ||
      lower === "start" ||
      lower === "stop" ||
      lower === "exit" ||
      lower === "reset"
    ) {
      // Reset conversation context
      await MarketplaceAgent.resetContext(userPhone, supabase);
      
      // Send welcome message
      await sendText(userPhone, WELCOME_MESSAGE);
      
      const duration = Date.now() - startTime;
      recordMetric("buy_sell.welcome_shown", 1, {
        duration_ms: duration,
      });
      
      return respond({ success: true, message: "welcome_shown" });
    }
    
    // Load context for regular messages (after filtering out reset commands)
    const context = await MarketplaceAgent.loadContext(userPhone, supabase);
    const isNewSession = !context.conversationHistory || context.conversationHistory.length === 0;
    
    // For new sessions with actual text, show welcome first then process
    if (isNewSession && text) {
      await sendText(userPhone, WELCOME_MESSAGE);
      
      await logStructuredEvent("BUY_SELL_WELCOME_NEW_USER", {
        from: `***${userPhone.slice(-4)}`,
        firstMessage: text.slice(0, 50),
        correlationId,
      });
    }
    
    // Process message with AI agent (passing the pre-loaded context)
    const agent = new MarketplaceAgent(supabase, correlationId);
    const response = await agent.process(text, context);
    
    // Send response to user
    await sendText(userPhone, response.message);

    const duration = Date.now() - startTime;
    recordMetric("buy_sell.agent_message.processed", 1, {
      duration_ms: duration,
      action: response.action,
    });

    return respond({ success: true, action: response.action });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Properly serialize error for logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logStructuredEvent(
      "BUY_SELL_ERROR",
      {
        error: errorMessage,
        stack: errorStack,
        durationMs: duration,
        requestId,
        correlationId,
      },
      "error",
    );

    recordMetric("buy_sell.message.error", 1);

    return respond({ error: errorMessage }, { status: 500 });
  }
});
