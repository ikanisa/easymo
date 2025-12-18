/**
 * WhatsApp Inbound Message Handler - Buy & Sell Agent
 * 
 * Processes incoming WhatsApp messages from vendors and users:
 * - Vendor replies (HAVE_IT, NO_STOCK, STOP_MESSAGES)
 * - Voice note transcription using Gemini
 * - User-vendor matching notifications
 * - Job queue insertion for async processing
 * 
 * Uses WhatsApp Cloud Business API webhooks per GROUND_RULES.md
 * 
 * @see docs/GROUND_RULES.md for webhook verification requirements
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { normalizePhoneNumber, maskPhone } from "../_shared/buy-sell-config.ts";
import { generateContent } from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";

// =====================================================
// TYPES
// =====================================================

interface WhatsAppMessage {
  id: string;
  from: string;
  type: "text" | "audio" | "image" | "video" | "document" | "location" | "button" | "interactive";
  timestamp: string;
  text?: { body: string };
  audio?: { id: string; mime_type: string };
  image?: { id: string; caption?: string };
  video?: { id: string };
  document?: { id: string; filename?: string };
  location?: { latitude: number; longitude: number };
  button?: { text: string; payload?: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

// =====================================================
// WEBHOOK VERIFICATION
// =====================================================

/**
 * Verify WhatsApp Cloud API webhook (GET request)
 */
function verifyWebhook(req: Request): Response | null {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = Deno.env.get("WA_WEBHOOK_VERIFY_TOKEN") || Deno.env.get("WA_VERIFY_TOKEN");

  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge || "", { status: 200 });
  }

  return null;
}

// =====================================================
// VENDOR ACTION DETECTION
// =====================================================

/**
 * Parse vendor action from message text
 */
function parseVendorAction(text: string): "HAVE_IT" | "NO_STOCK" | "STOP_MESSAGES" | null {
  const normalized = text.toLowerCase().trim();

  // HAVE_IT patterns - check for positive indicators anywhere in the message
  if (
    normalized.includes("have it") ||
    normalized.includes("in stock") ||
    normalized.includes("available") ||
    normalized.includes("yes") ||
    normalized.includes("yeah") ||
    normalized.includes("yep") ||
    normalized.includes("sure") ||
    normalized.startsWith("ok") ||
    normalized.startsWith("got it")
  ) {
    return "HAVE_IT";
  }

  // NO_STOCK patterns - check for negative indicators anywhere in the message
  if (
    normalized.includes("no stock") ||
    normalized.includes("out of stock") ||
    normalized.includes("don't have") ||
    normalized.includes("not available") ||
    normalized.includes("sold out") ||
    normalized.includes("nope") ||
    (normalized.includes("sorry") && !normalized.includes("have"))
  ) {
    return "NO_STOCK";
  }

  // STOP patterns
  if (
    normalized.includes("stop") ||
    normalized.includes("unsubscribe") ||
    normalized.includes("opt out") ||
    normalized.includes("remove me")
  ) {
    return "STOP_MESSAGES";
  }

  return null;
}

// =====================================================
// VOICE TRANSCRIPTION
// =====================================================

/**
 * Helper: Convert blob to base64
 */
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Transcribe voice note using Gemini
 */
async function transcribeVoiceNote(
  audioUrl: string,
  mimeType: string,
  correlationId: string
): Promise<string | null> {
  try {
    // Download audio
    const waToken = Deno.env.get("WA_TOKEN") || Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const audioResponse = await fetch(audioUrl, {
      headers: { Authorization: `Bearer ${waToken}` }
    });
    
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

// =====================================================
// MAIN HANDLER
// =====================================================

Deno.serve(async (req: Request): Promise<Response> => {
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
      
      // Health check
      return new Response(
        JSON.stringify({
          status: "healthy",
          service: "whatsapp-inbound",
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "method_not_allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse webhook payload
    const payload = await req.json();

    // WhatsApp Cloud API webhook structure
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages || value.messages.length === 0) {
      // No messages to process (could be status update)
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Process each message
    for (const message of value.messages as WhatsAppMessage[]) {
      const from = normalizePhoneNumber(message.from);
      const messageId = message.id;
      const messageType = message.type;

      await logStructuredEvent("INBOUND_MESSAGE_RECEIVED", {
        from: maskPhone(from),
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
        const waToken = Deno.env.get("WA_TOKEN") || Deno.env.get("WHATSAPP_ACCESS_TOKEN");
        
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
      } else if (messageType === "location" && message.location) {
        messageText = `[Location: ${message.location.latitude}, ${message.location.longitude}]`;
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

        // Get broadcast target ID if available (link reply to broadcast)
        let broadcastTargetId: string | null = null;
        try {
          // Try to find the most recent broadcast target for this vendor
          const { data: recentTarget } = await supabase
            .from("whatsapp_broadcast_targets")
            .select("id")
            .eq("business_phone", from)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          broadcastTargetId = recentTarget?.id || null;
        } catch (error) {
          // Continue without broadcast target ID
        }

        // Log vendor reply
        const { data: insertedReply } = await supabase
          .from("whatsapp_business_replies")
          .insert({
            business_phone: from,
            raw_body: messageText,
            action,
            has_stock: action === "HAVE_IT",
            broadcast_target_id: broadcastTargetId,
          })
          .select()
          .single();

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
            from: maskPhone(from),
            vendorName: vendor.business_name,
            correlationId
          });

          await recordMetric("vendor.opted_out", 1);
        }

        // Handle positive responses
        if (action === "HAVE_IT") {
          // Increment positive response count
          await supabase.rpc("increment_positive_response", {
            phone_input: from
          });

          await logStructuredEvent("VENDOR_POSITIVE_RESPONSE", {
            from: maskPhone(from),
            vendorName: vendor.business_name,
            correlationId
          });

          await recordMetric("vendor.positive_response", 1);
        }

        // Notify user of vendor response (for both HAVE_IT and NO_STOCK)
        if ((action === "HAVE_IT" || action === "NO_STOCK") && insertedReply) {
          try {
            // Import and call notification function
            const { notifyUserOfVendorResponse } = await import("../_shared/vendor-response-notification.ts");
            await notifyUserOfVendorResponse(supabase, insertedReply as any, correlationId);
          } catch (error) {
            logStructuredEvent("VENDOR_RESPONSE_NOTIFICATION_ERROR", {
              from: maskPhone(from),
              replyId: insertedReply.id,
              error: error instanceof Error ? error.message : String(error),
              correlationId
            }, "warn");
            // Don't block the flow if notification fails
          }
        }
      } else {
        // This is a user message - add to job queue for agent processing
        
        // Get or create user profile
        const { data: user } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("whatsapp_number", from)
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

          await recordMetric("inbound.message.queued", 1, { type: messageType });
        } else {
          // User not found - try to create via RPC
          const { data: newUser } = await supabase.rpc("get_or_create_user", {
            p_phone: from
          });
          
          if (newUser?.id) {
            await supabase.from("jobs").insert({
              user_id: newUser.id,
              type: "PROCESS_USER_MESSAGE",
              payload_json: {
                message: messageText,
                messageId,
                messageType,
                from
              },
              status: "pending"
            });

            await logStructuredEvent("JOB_QUEUED_NEW_USER", {
              userId: newUser.id,
              type: "PROCESS_USER_MESSAGE",
              correlationId
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

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
