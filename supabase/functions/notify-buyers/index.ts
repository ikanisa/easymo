/**
 * Notify Buyers - Buy & Sell Marketplace WhatsApp Webhook
 *
 * Handles WhatsApp webhook for Buy & Sell marketplace (AI agent conversation).
 * 
 * Features:
 * - AI-powered marketplace agent (EnhancedMarketplaceAgent)
 * - Voice note transcription (Gemini 2.5 Flash)
 * - Location-based vendor search
 * - Interactive button handling
 * - State machine for conversation flows
 * - Geo-fencing (Africa-only, blocks UG/KE/NG/ZA)
 * 
 * Note: Buyer alert scheduling has been moved to separate function: buyer-alert-scheduler
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { claimEvent } from "../_shared/wa-webhook-shared/state/idempotency.ts";
import { extractWhatsAppMessage } from "./utils/index.ts";
import {
  type BuyAndSellContext,
} from "./core/agent.ts";
import { EnhancedMarketplaceAgent } from "./core/agent-enhanced.ts";
import { transcribeVoiceNote } from "../_shared/voice/gemini-voice-bridge.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { classifyError, serializeError } from "./utils/error-handling.ts";
import { ensureProfile, getState, setState, clearState } from "../_shared/wa-webhook-shared/state/store.ts";
import { handleStateTransition } from "./handlers/state-machine.ts";
import { handleInteractiveButton, getProfileContext } from "./handlers/interactive-buttons.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase credentials for notify-buyers function");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =====================================================
// WHATSAPP WEBHOOK HANDLER
// =====================================================

type VendorCandidate = { id: string; name: string; phone: string; distance_m: number; tier: string };

async function fetchVendorsNearby(
  supabaseClient: typeof supabase,
  lat: number,
  lng: number,
  limit = 30,
): Promise<VendorCandidate[]> {
  const { data, error } = await supabaseClient.rpc("vendor_find_nearby", {
    p_lat: lat,
    p_lng: lng,
    p_limit: limit,
    p_radius_km: 20,
  });
  if (error || !data) return [];
  return data as VendorCandidate[];
}

function formatVendorList(vendors: VendorCandidate[], max = 10): string {
  const nums = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  return vendors.slice(0, max).map((v, idx) => {
    const emoji = nums[idx] ?? `${idx + 1}.`;
    const distKm = (v.distance_m / 1000).toFixed(1);
    const tierLabel = v.tier === "tier1" ? " (T1)" : v.tier === "tier2" ? " (T2)" : "";
    return `${emoji} ${v.name}${tierLabel} — ${distKm} km — ${v.phone}`;
  }).join("\n");
}

async function askVendorConsent(
  userPhone: string,
  profileId: string | null,
  supabaseClient: typeof supabase,
  vendors: VendorCandidate[],
  correlationId: string,
) {
  if (!vendors.length) return false;
  await setState(supabaseClient, profileId ?? userPhone, {
    key: "VENDOR_CONSENT",
    data: {
      vendors,
      expireAt: Date.now() + 10 * 60 * 1000,
    },
  });

  const listText = formatVendorList(vendors);
  await sendText(
    userPhone,
    `✅ I found ${vendors.length} nearby vendors:\n\n${listText}\n\nShould I message them for availability and prices?\nReply YES to contact them all, or NO to skip.`,
  );
  logStructuredEvent("VENDOR_CONSENT_REQUESTED", {
    correlationId,
    userPhone: `***${userPhone.slice(-4)}`,
    vendorCount: vendors.length,
  });
  return true;
}

async function handleVendorConsentResponse(
  supabaseClient: typeof supabase,
  userPhone: string,
  profileId: string | null,
  text: string,
  correlationId: string,
): Promise<boolean> {
  const state = await getState(supabaseClient, profileId ?? userPhone);
  if (!state || state.key !== "VENDOR_CONSENT") return false;

  const decision = text.trim().toLowerCase();
  if (!["yes", "y", "ok", "sure", "yeah", "yes!"].includes(decision) &&
    !["no", "n", "nope", "nah"].includes(decision)) {
      await sendText(userPhone, "Please reply YES to contact vendors or NO to skip.");
      return true;
    }

  if (["no", "n", "nope", "nah"].includes(decision)) {
    await clearState(supabaseClient, profileId ?? userPhone);
    await sendText(userPhone, "Okay, I won't contact vendors right now.");
    return true;
  }

  const vendors = (state.data?.vendors ?? []) as VendorCandidate[];
  if (!vendors.length) {
    await clearState(supabaseClient, profileId ?? userPhone);
    await sendText(userPhone, "I lost the vendor list. Please share your location again.");
    return true;
  }

  const rows = vendors.map((v) => ({
    user_profile_id: profileId,
    user_phone: userPhone,
    vendor_id: v.id,
    vendor_phone: v.phone,
    payload: { name: v.name, tier: v.tier, distance_m: v.distance_m },
    status: "pending",
  }));
  const { error } = await supabaseClient.from("vendor_outreach_queue").insert(rows);
  await clearState(supabaseClient, profileId ?? userPhone);

  if (error) {
    logStructuredEvent("VENDOR_OUTREACH_ENQUEUE_FAILED", {
      correlationId,
      error: error.message,
      userPhone: `***${userPhone.slice(-4)}`,
    }, "error");
    await sendText(userPhone, "I couldn't start the vendor outreach. Please try again.");
    return true;
  }

  await sendText(userPhone, "🚀 Got it! I'm messaging nearby vendors now. I'll update you as soon as anyone replies.");
  logStructuredEvent("VENDOR_OUTREACH_ENQUEUED", {
    correlationId,
    userPhone: `***${userPhone.slice(-4)}`,
    vendorCount: vendors.length,
  });
  return true;
}

async function handleWhatsAppWebhook(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", "notify-buyers");
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Rate limiting (100 req/min for high-volume WhatsApp)
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: 100,
    windowSeconds: 60,
  });

  if (!rateLimitCheck.allowed) {
    if (rateLimitCheck.response) {
      return rateLimitCheck.response;
    }
    return respond({ error: "rate_limit_exceeded" }, { status: 429 });
  }

  const startTime = Date.now();

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify WhatsApp signature
    const signatureHeader = req.headers.has("x-hub-signature-256")
      ? "x-hub-signature-256"
      : req.headers.has("x-hub-signature")
      ? "x-hub-signature"
      : null;
    const signature = signatureHeader ? req.headers.get(signatureHeader) : null;
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ??
      Deno.env.get("WA_APP_SECRET");
    const allowUnsigned =
      (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() ===
        "true";
    const internalForward = req.headers.get("x-wa-internal-forward") === "true";

    if (!appSecret) {
      logStructuredEvent("NOTIFY_BUYERS_AUTH_CONFIG_ERROR", {
        error: "WHATSAPP_APP_SECRET not configured",
        correlationId,
      }, "error");
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }

    let isValidSignature = false;
    if (signature) {
      try {
        isValidSignature = await verifyWebhookSignature(
          rawBody,
          signature,
          appSecret,
        );
        if (isValidSignature) {
          logStructuredEvent("NOTIFY_BUYERS_SIGNATURE_VALID", {
            signatureHeader,
            correlationId,
          });
        }
      } catch (err) {
        logStructuredEvent("NOTIFY_BUYERS_SIGNATURE_ERROR", {
          error: err instanceof Error ? err.message : String(err),
          correlationId,
        }, "error");
      }
    }

    if (!isValidSignature) {
      if (allowUnsigned || internalForward) {
        logStructuredEvent("NOTIFY_BUYERS_AUTH_BYPASS", {
          reason: internalForward
            ? "internal_forward"
            : signature
            ? "signature_mismatch"
            : "no_signature",
          correlationId,
        }, "warn");
      } else {
        logStructuredEvent("NOTIFY_BUYERS_AUTH_FAILED", {
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

    let text = message.body?.trim() ?? "";
    const userPhone = message.from;
    const normalizedPhone = userPhone.startsWith("+") ? userPhone : `+${userPhone}`;

    // === VOICE NOTE HANDLING ===
    // Handle audio messages (voice notes)
    if (message.type === "audio" && message.audio) {
      const audioId = message.audio.id;
      const getEnv = (key: string) => {
        if (typeof Deno !== "undefined") return Deno.env.get(key);
        // @ts-ignore
        return typeof process !== "undefined" ? process.env[key] : undefined;
      };
      
      const waToken = getEnv("WHATSAPP_ACCESS_TOKEN") || getEnv("WA_TOKEN");
      
      if (audioId && waToken) {
        try {
          // Step 1: Get audio URL from WhatsApp
          const mediaResponse = await fetch(
            `https://graph.facebook.com/v18.0/${audioId}`,
            {
              headers: { Authorization: `Bearer ${waToken}` }
            }
          );

          if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json();
            const audioUrl = mediaData.url;

            // Step 2: Download audio
            const audioResponse = await fetch(audioUrl, {
              headers: { Authorization: `Bearer ${waToken}` }
            });

            if (audioResponse.ok) {
              const audioBlob = await audioResponse.blob();
              const arrayBuffer = await audioBlob.arrayBuffer();
              const audioBuffer = new Uint8Array(arrayBuffer);

              // Step 3: Transcribe using Gemini 2.5 Flash Native Audio
              const transcription = await transcribeVoiceNote(
                audioBuffer,
                message.audio.mime_type || "audio/ogg",
                correlationId
              );

              if (transcription) {
                text = transcription;
                
                await logStructuredEvent("NOTIFY_BUYERS_VOICE_TRANSCRIBED", {
                  from: `***${userPhone.slice(-4)}`,
                  textLength: text.length,
                  correlationId,
                });
                
                await recordMetric("notify_buyers.voice.transcribed", 1, {
                  textLength: text.length,
                });
              } else {
                await logStructuredEvent("NOTIFY_BUYERS_VOICE_TRANSCRIPTION_FAILED", {
                  from: `***${userPhone.slice(-4)}`,
                  correlationId,
                  reason: "empty_transcription",
                }, "warn");
                
                await recordMetric("notify_buyers.voice.transcription_failed", 1, {
                  reason: "empty_transcription",
                });
                
                await sendText(
                  userPhone,
                  "⚠️ *Voice Message Issue*\n\n" +
                  "I couldn't understand your voice message. This might be because:\n" +
                  "• The audio quality was too low\n" +
                  "• The message was too short\n" +
                  "• Background noise was too loud\n\n" +
                  "💡 *Please try:*\n" +
                  "• Speaking more clearly\n" +
                  "• Recording in a quieter place\n" +
                  "• Or type your message instead"
                );
                return respond({ success: true, message: "voice_transcription_failed" });
              }
            } else {
              await logStructuredEvent("NOTIFY_BUYERS_VOICE_MEDIA_DOWNLOAD_FAILED", {
                from: `***${userPhone.slice(-4)}`,
                correlationId,
                status: audioResponse.status,
              }, "warn");
              
              await recordMetric("notify_buyers.voice.download_failed", 1, {
                status: audioResponse.status,
              });
              
              await sendText(
                userPhone,
                "⚠️ *Voice Message Issue*\n\n" +
                "I couldn't download your voice message. Please try:\n" +
                "• Sending the voice message again\n" +
                "• Or type your message instead"
              );
              return respond({ success: true, message: "voice_download_failed" });
            }
          } else {
            await logStructuredEvent("NOTIFY_BUYERS_VOICE_MEDIA_URL_FAILED", {
              from: `***${userPhone.slice(-4)}`,
              correlationId,
              status: mediaResponse.status,
            }, "warn");
            
            await recordMetric("notify_buyers.voice.media_url_failed", 1, {
              status: mediaResponse.status,
            });
            
            await sendText(
              userPhone,
              "⚠️ *Voice Message Issue*\n\n" +
              "I couldn't access your voice message. Please try:\n" +
              "• Sending the voice message again\n" +
              "• Or type your message instead"
            );
            return respond({ success: true, message: "voice_media_url_failed" });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          
          await logStructuredEvent("NOTIFY_BUYERS_VOICE_ERROR", {
            error: errorMessage,
            stack: errorStack,
            from: `***${userPhone.slice(-4)}`,
            correlationId,
            errorType: error instanceof TypeError ? "type_error" : 
                      error instanceof Error ? "generic_error" : "unknown_error",
          }, "error");
          
          await recordMetric("notify_buyers.voice.error", 1, {
            error_type: error instanceof TypeError ? "type_error" : 
                       error instanceof Error ? "generic_error" : "unknown_error",
          });
          
          await sendText(
            userPhone,
            "⚠️ *Voice Message Error*\n\n" +
            "I encountered an error processing your voice message:\n" +
            `• ${errorMessage}\n\n` +
            "💡 *Please try:*\n" +
            "• Sending the voice message again\n" +
            "• Or type your message instead\n\n" +
            "If this keeps happening, please contact support."
          );
          return respond({ success: true, message: "voice_processing_error" });
        }
      }
    }

    // CRITICAL: Deduplicate messages using message_id to prevent spam
    const messageId = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
      ?.id;
    if (messageId) {
      const claimed = await claimEvent(messageId, userPhone);
      if (!claimed) {
        await logStructuredEvent("NOTIFY_BUYERS_DUPLICATE_BLOCKED", {
          message_id: messageId,
          from: `***${userPhone.slice(-4)}`,
          correlationId,
        });
        return respond({ success: true, message: "duplicate_blocked" });
      }
    }

    logStructuredEvent("NOTIFY_BUYERS_MESSAGE_RECEIVED", {
      from: userPhone,
      type: message.type,
      hasLocation: !!message.location,
      hasAudio: !!message.audio,
      requestId,
    });

    // Lookup profile once at the beginning
    let profile: { user_id: string; language?: string } | null = null;
    try {
      const profileData = await ensureProfile(supabase, normalizedPhone);
      if (profileData) {
        profile = {
          user_id: profileData.user_id,
          language: profileData.locale,
        };
      }
    } catch (err) {
      logStructuredEvent("NOTIFY_BUYERS_PROFILE_LOOKUP_EXCEPTION", {
        error: err instanceof Error ? err.message : String(err),
        userPhone: `***${userPhone.slice(-4)}`,
        correlationId,
      }, "error");
      // Continue without profile; do not fail the request
    }

    // === INTERACTIVE HANDLERS ===

    // Button replies
    if (
      message.type === "interactive" && message.interactive?.button_reply?.id
    ) {
      const buttonId = message.interactive.button_reply.id;

      logStructuredEvent("NOTIFY_BUYERS_BUTTON_CLICKED", {
        buttonId,
        userPhone: `***${userPhone.slice(-4)}`,
        correlationId,
      });

      // handleInteractiveButton is now statically imported

      const result = await handleInteractiveButton(
        buttonId,
        userPhone,
        supabase,
        correlationId,
      );
      if (result.handled) {
        await recordMetric("notify_buyers.button.handled", 1, { buttonId });
        return respond({
          success: true,
          message: result.action || "button_handled",
        });
      } else {
        await recordMetric("notify_buyers.button.unhandled", 1, { buttonId });
      }
    }

    // List replies (e.g., user selects "Buy & Sell" from the home menu)
    if (message.type === "interactive" && message.interactive?.list_reply?.id) {
      const listId = message.interactive.list_reply.id.trim().toLowerCase();

      // Entry points routed from wa-webhook-core home menu
      if (
        [
          "buy_sell",
          "buy_and_sell",
          "buy_and_sell_agent",
          "buy_sell_agent",
          "marketplace",
          "shops_services",
        ].includes(listId)
      ) {
        // Reset context and show welcome, but do not treat the menu title as a user query
        await EnhancedMarketplaceAgent.resetContext(normalizedPhone, supabase);

        const locale = profile?.language || "en";
        const { getWelcomeMessage } = await import("./core/agent.ts");
        const welcomeMessage = await getWelcomeMessage(locale);
        await sendText(userPhone, welcomeMessage);

        await logStructuredEvent("NOTIFY_BUYERS_MENU_ENTRY", {
          listId,
          userPhone: `***${userPhone.slice(-4)}`,
          correlationId,
        });

        return respond({ success: true, message: "menu_entry" });
      }
    }

    // === LOCATION HANDLER ===

    // Location sharing - pass to AI agent with location context
    if (message.type === "location" && message.location) {
      // Validate location data
      const lat = message.location.latitude;
      const lng = message.location.longitude;

      if (
        typeof lat !== "number" || typeof lng !== "number" ||
        isNaN(lat) || isNaN(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180
      ) {
        logStructuredEvent("NOTIFY_BUYERS_INVALID_LOCATION", {
          lat,
          lng,
          userPhone: `***${userPhone.slice(-4)}`,
          correlationId,
        }, "warn");
        await sendText(
          userPhone,
          "⚠️ Invalid location data. Please share your location again.",
        );
        return respond({ success: true, message: "invalid_location" });
      }

      // Vendor discovery flow: fetch nearby vendors and ask consent
      const vendors = await fetchVendorsNearby(supabase, lat, lng, 30);
      if (vendors.length > 0) {
        await askVendorConsent(userPhone, profile?.user_id ?? null, supabase, vendors, correlationId);
        return respond({ success: true, message: "vendor_consent_requested" });
      }

      if (profile) {
        // Load or create context with location
        const context: BuyAndSellContext = await EnhancedMarketplaceAgent.loadContext(
          normalizedPhone,
          supabase,
        );
        context.location = {
          lat,
          lng,
        };

        // Process location with enhanced agent
        const agent = new EnhancedMarketplaceAgent(supabase, correlationId);
        const response = await agent.process("I shared my location", context);

        await sendText(userPhone, response.message);
        return respond({
          success: true,
          message: "location_processed_by_agent",
        });
      }
    }

    // === TEXT HANDLERS ===

    if (profile) {
      const state = await getState(supabase, profile.user_id);

      // Handle vendor consent first if present
      if (state?.key === "VENDOR_CONSENT") {
        const handledConsent = await handleVendorConsentResponse(
          supabase,
          userPhone,
          profile.user_id,
          text.toLowerCase(),
          correlationId,
        );
        if (handledConsent) {
          return respond({ success: true, message: "vendor_consent_handled" });
        }
      }

      // Handle state transitions using state machine handler
      if (state) {
        logStructuredEvent("NOTIFY_BUYERS_STATE_TRANSITION", {
          stateKey: state.key,
          userPhone: `***${userPhone.slice(-4)}`,
          correlationId,
        });

        // handleStateTransition and getProfileContext are now statically imported

        const ctx = await getProfileContext(userPhone, supabase);
        if (ctx) {
          const result = await handleStateTransition(
            state,
            text,
            ctx,
            correlationId,
          );
          if (result.handled) {
            await recordMetric("notify_buyers.state_transition.handled", 1, {
              stateKey: state.key,
            });
            return respond({
              success: true,
              message: "state_transition_handled",
            });
          } else {
            await recordMetric("notify_buyers.state_transition.unhandled", 1, {
              stateKey: state.key || "unknown",
            });
          }
        }
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
      await EnhancedMarketplaceAgent.resetContext(normalizedPhone, supabase);

      // Send localized welcome message
      const locale = profile?.language || "en";
      const { getWelcomeMessage } = await import("./core/agent.ts");
      const welcomeMessage = await getWelcomeMessage(locale);
      await sendText(userPhone, welcomeMessage);

      const duration = Date.now() - startTime;
      recordMetric("notify_buyers.welcome_shown", 1, {
        duration_ms: duration,
      });

      return respond({ success: true, message: "welcome_shown" });
    }

    // Load context for regular messages
    const context = await EnhancedMarketplaceAgent.loadContext(normalizedPhone, supabase);
    const isNewSession = !context.conversationHistory ||
      context.conversationHistory.length === 0;

    // For new sessions with actual text, show welcome first then process
    if (isNewSession && text) {
      const locale = profile?.language || "en";
      const { getWelcomeMessage } = await import("./core/agent.ts");
      const welcomeMessage = await getWelcomeMessage(locale);
      await sendText(userPhone, welcomeMessage);

      await logStructuredEvent("NOTIFY_BUYERS_WELCOME_NEW_USER", {
        from: `***${userPhone.slice(-4)}`,
        firstMessage: text.slice(0, 50),
        correlationId,
      });
    }

    // Process message with enhanced AI agent
    const agent = new EnhancedMarketplaceAgent(supabase, correlationId);
    const response = await agent.process(text, context);

    // Send response to user
    await sendText(userPhone, response.message);

    const duration = Date.now() - startTime;
    recordMetric("notify_buyers.agent_message.processed", 1, {
      duration_ms: duration,
      action: response.action,
    });

    return respond({ success: true, action: response.action });
  } catch (error) {
    const duration = Date.now() - startTime;
    const { message: errorMessage, stack: errorStack, code: errorCode } =
      serializeError(error);
    const { isUserError, isSystemError, statusCode } = classifyError(error);

    logStructuredEvent(
      "NOTIFY_BUYERS_ERROR",
      {
        error: errorMessage,
        errorCode,
        stack: errorStack,
        durationMs: duration,
        requestId,
        correlationId,
        errorType: isUserError
          ? "user_error"
          : (isSystemError ? "system_error" : "unknown_error"),
        statusCode,
      },
      isSystemError ? "error" : "warn",
    );

    recordMetric("notify_buyers.message.error", 1, {
      error_type: isUserError
        ? "user_error"
        : (isSystemError ? "system_error" : "unknown_error"),
    });

    return respond({
      error: isUserError
        ? "invalid_request"
        : (isSystemError ? "service_unavailable" : "internal_error"),
      message: isUserError
        ? errorMessage
        : "An error occurred. Please try again later.",
    }, { status: statusCode });
  }
}

// =====================================================
// MAIN ROUTER
// =====================================================

serve(async (req: Request): Promise<Response> => {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", "notify-buyers");
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check and webhook verification endpoint (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // WhatsApp webhook verification
    const getEnv = (key: string) => {
      if (typeof Deno !== "undefined") return Deno.env.get(key);
      // @ts-ignore
      return typeof process !== "undefined" ? process.env[key] : undefined;
    };
    
    const verifyToken = getEnv("WA_VERIFY_TOKEN") || getEnv("WHATSAPP_VERIFY_TOKEN");
    if (mode === "subscribe" && token === verifyToken) {
      return new Response(challenge ?? "", {
        status: 200,
        headers: {
          "X-Request-ID": requestId,
          "X-Correlation-ID": correlationId,
        },
      });
    }

    // Health check (no verification params)
    if (!mode && !token) {
      const health = await EnhancedMarketplaceAgent.healthCheck();

      return respond({
        status: "healthy",
        service: "notify-buyers",
        scope: "buyer_alerts_and_whatsapp_marketplace",
        aiProvider: health.aiProvider,
        timestamp: new Date().toISOString(),
      });
    }

    // Invalid verification attempt
    return respond({ error: "forbidden" }, { status: 403 });
  }

  // Only POST is allowed
  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  // This function only handles WhatsApp webhooks
  // Buyer alert scheduling is handled by the separate buyer-alert-scheduler function
  return await handleWhatsAppWebhook(req);
});

logStructuredEvent("SERVICE_STARTED", {
  service: "notify-buyers",
  version: "2.0.0",
  scope: "whatsapp_marketplace_ai_agent",
  note: "Buyer alert scheduling handled by separate buyer-alert-scheduler function",
});
