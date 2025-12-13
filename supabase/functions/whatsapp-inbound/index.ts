/**
 * WhatsApp Inbound Handler Edge Function
 * 
 * Processes incoming WhatsApp messages for Buy & Sell agent
 * 
 * Features:
 * - Vendor reply processing (HAVE_IT, NO_STOCK, STOP_MESSAGES)
 * - User-vendor matching notifications (using WhatsApp Cloud API)
 * - Voice note transcription using Gemini
 * - User upsert and message queuing to jobs table
 * - Positive response metrics tracking
 * 
 * IMPORTANT: Uses WhatsApp Cloud Business API per ground rules
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { transcribeAudio } from "../_shared/buy-sell-gemini.ts";
import { maskPhone } from "../_shared/buy-sell-config.ts";
import type { WhatsAppMessage } from "../_shared/buy-sell-types.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

serve(async (req: Request): Promise<Response> => {
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", "whatsapp-inbound");
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Webhook verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { status: 200 });
    }

    return respond({
      status: "healthy",
      service: "whatsapp-inbound",
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  try {
    const payload = await req.json();

    // Extract WhatsApp message from webhook payload
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages?.[0]) {
      // No message to process (might be status update)
      return respond({ status: "ok", message: "No message to process" });
    }

    const message: WhatsAppMessage = value.messages[0];
    const from = message.from;
    const messageId = message.id;
    const messageType = message.type;

    await logStructuredEvent("INBOUND_MESSAGE_RECEIVED", {
      from: maskPhone(from),
      type: messageType,
      messageId,
      correlationId,
    });

    // Extract message content
    let messageText = "";
    let mediaUrl: string | undefined;

    if (messageType === "text") {
      messageText = message.text?.body || "";
    } else if (messageType === "audio") {
      // Download and transcribe audio
      const audioId = message.audio?.id;
      if (audioId) {
        const audioData = await downloadWhatsAppMedia(audioId);
        if (audioData) {
          const transcript = await transcribeAudio(
            audioData,
            message.audio?.mime_type || "audio/ogg",
            correlationId
          );
          messageText = transcript || "[Voice message - transcription failed]";
          mediaUrl = audioId;
        }
      }
    } else if (messageType === "image") {
      messageText = message.image?.caption || "[Image]";
      mediaUrl = message.image?.id;
    } else if (messageType === "location") {
      messageText = `Location: ${message.location?.latitude}, ${message.location?.longitude}`;
    }

    // Get or create WhatsApp user
    const { data: userData, error: userError } = await supabase.rpc("get_or_create_user", {
      p_phone: from,
    });

    if (userError || !userData) {
      await logStructuredEvent("USER_UPSERT_FAILED", {
        error: userError?.message || "User data not returned",
        correlationId,
      });
      // Return early to avoid processing with undefined userId
      return respond({ status: "error", message: "Failed to get or create user" }, { status: 500 });
    }

    const userId = userData.id;

    // Log inbound message
    await supabase.from("inbound_messages").insert({
      user_id: userId,
      type: messageType,
      text: messageText,
      media_url: mediaUrl,
      wa_message_id: messageId,
    });

    // Check if this is a vendor reply to a broadcast
    const action = detectVendorAction(messageText);

    if (action !== "UNKNOWN") {
      await processVendorReply(from, messageText, action, correlationId);
      return respond({ status: "ok", processed: "vendor_reply" });
    }

    // Otherwise, queue as a regular user message for agent processing
    await supabase.from("jobs").insert({
      user_id: userId,
      type: "process_user_message",
      payload_json: {
        from,
        messageText,
        messageType,
        messageId,
        mediaUrl,
      },
      status: "pending",
    });

    await recordMetric("inbound.message.queued", 1, {
      type: messageType,
    });

    return respond({ status: "ok", queued: true });
  } catch (error) {
    await logStructuredEvent("INBOUND_ERROR", {
      error: error.message,
      correlationId,
    });

    return respond(
      {
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
});

/**
 * Detect vendor action from message text
 */
function detectVendorAction(text: string): "HAVE_IT" | "NO_STOCK" | "STOP_MESSAGES" | "UNKNOWN" {
  const normalized = text.toLowerCase().trim();

  if (
    normalized.includes("have it") ||
    normalized.includes("have_it") ||
    normalized.includes("yes") ||
    normalized.includes("available")
 * WhatsApp Inbound Message Handler
 * 
 * Handles incoming WhatsApp messages from vendors and users:
 * - Vendor replies (HAVE_IT, NO_STOCK, STOP_MESSAGES)
 * - Voice note transcription using Gemini
 * - User-vendor matching notifications
 * - Job queue insertion for async processing
 * 
 * Uses WhatsApp Cloud Business API webhooks per GROUND_RULES.md
 * 
 * @see docs/GROUND_RULES.md for webhook verification requirements
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
import { normalizePhoneNumber } from "../_shared/buy-sell-config.ts";
import { generateContent } from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";
import type { WhatsAppMessage } from "../_shared/types/buy-sell.ts";

// Webhook verification (WhatsApp Cloud API)
function verifyWebhook(req: Request): Response | null {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = Deno.env.get("WA_WEBHOOK_VERIFY_TOKEN");

  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge, { status: 200 });
  }

  return null;
}

// Parse vendor action from message text
function parseVendorAction(text: string): "HAVE_IT" | "NO_STOCK" | "STOP_MESSAGES" | null {
  const normalized = text.toLowerCase().trim();

  // HAVE_IT patterns
  if (
    normalized.includes("have it") ||
    normalized.includes("in stock") ||
    normalized.includes("available") ||
    normalized.match(/yes|yeah|yep|sure/i)
  ) {
    return "HAVE_IT";
  }

  if (
    normalized.includes("no stock") ||
    normalized.includes("no_stock") ||
    normalized.includes("not available") ||
    normalized.includes("dont have")
  // NO_STOCK patterns
  if (
    normalized.includes("no stock") ||
    normalized.includes("out of stock") ||
    normalized.includes("don't have") ||
    normalized.includes("not available") ||
    normalized.match(/no|nope|sorry/i)
  ) {
    return "NO_STOCK";
  }

  if (
    normalized.includes("stop") ||
    normalized.includes("unsubscribe") ||
    normalized.includes("opt out")
  // STOP patterns
  if (
    normalized.includes("stop") ||
    normalized.includes("unsubscribe") ||
    normalized.includes("opt out") ||
    normalized.includes("remove me")
  ) {
    return "STOP_MESSAGES";
  }

  return "UNKNOWN";
}

/**
 * Process vendor reply to broadcast
 */
async function processVendorReply(
  phone: string,
  rawBody: string,
  action: string,
  correlationId: string
): Promise<void> {
  // Find the most recent broadcast target for this vendor
  const { data: target } = await supabase
    .from("whatsapp_broadcast_targets")
    .select("*, whatsapp_broadcast_requests!inner(*)")
    .eq("business_phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!target) {
    await logStructuredEvent("VENDOR_REPLY_NO_TARGET", {
      phone: maskPhone(phone),
      correlationId,
    });
    return;
  }

  // Log the reply
  await supabase.from("whatsapp_business_replies").insert({
    business_phone: phone,
    raw_body: rawBody,
    action,
    has_stock: action === "HAVE_IT",
    broadcast_target_id: target.id,
  });

  await logStructuredEvent("VENDOR_REPLY_LOGGED", {
    phone: maskPhone(phone),
    action,
    correlationId,
  });

  if (action === "STOP_MESSAGES") {
    // Add to opt-outs
    await supabase.from("whatsapp_opt_outs").upsert(
      {
        business_phone: phone,
        reason: "User requested via STOP",
      },
      {
        onConflict: "business_phone",
      }
    );

    // Update vendor opt-in status
    await supabase.from("vendors").update({ is_opted_in: false }).eq("phone", phone);

    await recordMetric("vendor.opted_out", 1);
  } else if (action === "HAVE_IT") {
    // Increment positive response count
    await supabase.rpc("increment_positive_response", {
      phone_input: phone,
    });

    await recordMetric("vendor.positive_response", 1);

    // TODO: Notify the user who made the request
    // This would require tracking which user initiated the broadcast
    // For now, we just log it
    await logStructuredEvent("VENDOR_HAS_STOCK", {
      vendor_phone: maskPhone(phone),
      business_name: target.business_name,
      correlationId,
    });
  }
}

/**
 * Download WhatsApp media via Cloud Business API
 */
async function downloadWhatsAppMedia(mediaId: string): Promise<Uint8Array | null> {
  try {
    // Get media URL
    const mediaInfoResponse = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
      }
    );

    const mediaInfo = await mediaInfoResponse.json();
    const mediaUrl = mediaInfo.url;

    if (!mediaUrl) {
      return null;
    }

    // Download media
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    const arrayBuffer = await mediaResponse.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    await logStructuredEvent("MEDIA_DOWNLOAD_FAILED", {
      mediaId,
      error: error.message,
    });
    return null;
  }
}
  return null;
}

// Transcribe voice note using Gemini
async function transcribeVoiceNote(
  audioUrl: string,
  mimeType: string,
  correlationId: string
): Promise<string | null> {
  try {
    // Download audio
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    const audioBlob = await audioResponse.blob();
    const audioBase64 = await blobToBase64(audioBlob);

    // Transcribe with Gemini
    const result = await generateContent(
      [
        {
          text: "Transcribe this audio message accurately. Only return the transcribed text, nothing else."
        },
        {
          inlineData: {
            mimeType,
            data: audioBase64
          }
        }
      ],
      {
        model: "gemini-2.0-flash-exp",
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500
        },
        correlationId
      }
    );

    if (result.text) {
      await logStructuredEvent("VOICE_NOTE_TRANSCRIBED", {
        textLength: result.text.length,
        correlationId
      });
      return result.text;
    }

    return null;
  } catch (error) {
    await logStructuredEvent("VOICE_NOTE_TRANSCRIPTION_ERROR", {
      error: (error as Error).message,
      correlationId
    }, "error");
    return null;
  }
}

// Helper: Convert blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    // Handle webhook verification (GET request)
    if (req.method === "GET") {
      const verification = verifyWebhook(req);
      if (verification) {
        return verification;
      }
      return new Response("Invalid verification", { status: 403 });
    }

    // Parse webhook payload
    const payload = await req.json();

    // WhatsApp Cloud API webhook structure
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages || value.messages.length === 0) {
      // No messages to process (could be status update)
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Process each message
    for (const message of value.messages) {
      const from = normalizePhoneNumber(message.from);
      const messageId = message.id;
      const messageType = message.type;

      await logStructuredEvent("INBOUND_MESSAGE_RECEIVED", {
        from,
        type: messageType,
        messageId,
        correlationId
      });

      let messageText = "";

      // Extract text based on message type
      if (messageType === "text") {
        messageText = message.text?.body || "";
      } else if (messageType === "audio" && message.audio) {
        // Get audio URL from WhatsApp
        const audioId = message.audio.id;
        const waToken = Deno.env.get("WA_TOKEN");
        
        if (audioId && waToken) {
          // Fetch audio URL
          const mediaResponse = await fetch(
            `https://graph.facebook.com/v18.0/${audioId}`,
            {
              headers: { Authorization: `Bearer ${waToken}` }
            }
          );

          if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json();
            const audioUrl = mediaData.url;

            // Transcribe voice note
            const transcription = await transcribeVoiceNote(
              audioUrl,
              message.audio.mime_type,
              correlationId
            );

            if (transcription) {
              messageText = transcription;
            }
          }
        }
      } else if (messageType === "button" && message.button) {
        messageText = message.button.text || "";
      } else if (messageType === "interactive" && message.interactive) {
        messageText = message.interactive.button_reply?.title || 
                     message.interactive.list_reply?.title || "";
      }

      // Log inbound message
      await supabase.from("inbound_messages").insert({
        type: messageType,
        text: messageText,
        media_url: messageType === "audio" ? message.audio?.id : null,
        wa_message_id: messageId
      });

      // Check if this is a vendor reply
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, business_name")
        .eq("phone", from)
        .single();

      if (vendor) {
        // This is a vendor replying
        const action = parseVendorAction(messageText);

        // Log vendor reply
        await supabase.from("whatsapp_business_replies").insert({
          business_phone: from,
          raw_body: messageText,
          action,
          has_stock: action === "HAVE_IT"
        });

        // Handle STOP messages
        if (action === "STOP_MESSAGES") {
          await supabase.from("whatsapp_opt_outs").upsert({
            business_phone: from,
            reason: "User requested stop"
          });

          await supabase
            .from("vendors")
            .update({ is_opted_in: false })
            .eq("phone", from);

          await logStructuredEvent("VENDOR_OPTED_OUT", {
            from,
            vendorName: vendor.business_name,
            correlationId
          });
        }

        // Handle positive responses
        if (action === "HAVE_IT") {
          // Increment positive response count
          await supabase.rpc("increment_positive_response", {
            phone_input: from
          });

          await logStructuredEvent("VENDOR_POSITIVE_RESPONSE", {
            from,
            vendorName: vendor.business_name,
            correlationId
          });

          // TODO: Notify matching buyers
        }
      } else {
        // This is a user message - add to job queue for agent processing
        const { data: user } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("phone", from)
          .single();

        if (user) {
          await supabase.from("jobs").insert({
            user_id: user.user_id,
            type: "PROCESS_USER_MESSAGE",
            payload_json: {
              message: messageText,
              messageId,
              messageType,
              from
            },
            status: "pending"
          });

          await logStructuredEvent("JOB_QUEUED", {
            userId: user.user_id,
            type: "PROCESS_USER_MESSAGE",
            correlationId
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    await logStructuredEvent("INBOUND_MESSAGE_ERROR", {
      error: (error as Error).message,
      stack: (error as Error).stack,
      correlationId
    }, "error");

    return new Response(
      JSON.stringify({
        error: "Processing failed",
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
