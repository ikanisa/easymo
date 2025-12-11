// Tool: Notify User
// Multi-channel notification system for property updates
// Supports WhatsApp messages, templates, and PWA push notifications

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { createClient } from "@supabase/supabase-js";
import { logStructuredEvent } from "../_shared/observability.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WABA_PHONE_NUMBER_ID = Deno.env.get("WABA_PHONE_NUMBER_ID")!;
const WABA_ACCESS_TOKEN = Deno.env.get("WABA_ACCESS_TOKEN")!;

interface NotifyRequest {
  conversation_id: string;
  channel: "whatsapp" | "pwa_push" | "sms";
  notification_type: "shortlist_ready" | "owner_replied" | "viewing_scheduled" | "custom";
  payload: {
    title?: string;
    message?: string;
    template_name?: string;
    template_params?: Record<string, string>;
    deep_link?: string;
    action_buttons?: Array<{ id: string; title: string }>;
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get("x-correlation-id") ||
    crypto.randomUUID();
  const startTime = Date.now();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const request: NotifyRequest = await req.json();

    console.log(
      JSON.stringify({
        event: "NOTIFY_USER_START",
        correlationId,
        conversationId: request.conversation_id,
        channel: request.channel,
        type: request.notification_type,
        timestamp: new Date().toISOString(),
      }),
    );

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("*, profiles(*)")
      .eq("id", request.conversation_id)
      .single();

    if (convError) throw convError;

    let result;
    switch (request.channel) {
      case "whatsapp":
        result = await sendWhatsAppNotification(
          conversation,
          request,
          correlationId,
        );
        break;
      case "pwa_push":
        result = await sendPWAPushNotification(
          conversation,
          request,
          correlationId,
        );
        break;
      case "sms":
        result = await sendSMSNotification(
          conversation,
          request,
          correlationId,
        );
        break;
      default:
        throw new Error(`Unsupported channel: ${request.channel}`);
    }

    // Log notification event
    await supabase.from("analytics_events").insert({
      event_type: "notification_sent",
      event_data: {
        conversation_id: request.conversation_id,
        channel: request.channel,
        notification_type: request.notification_type,
        success: result.success,
      },
    });

    console.log(
      JSON.stringify({
        event: "NOTIFY_USER_COMPLETE",
        correlationId,
        conversationId: request.conversation_id,
        success: result.success,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }),
    );

    return new Response(
      JSON.stringify({
        success: result.success,
        message_id: result.message_id,
        channel: request.channel,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "NOTIFY_USER_ERROR",
        correlationId,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }),
    );

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function sendWhatsAppNotification(
  conversation: any,
  request: NotifyRequest,
  correlationId: string,
): Promise<{ success: boolean; message_id?: string }> {
  const phoneNumber = conversation.profiles?.phone;
  if (!phoneNumber) {
    throw new Error("No phone number found for user");
  }

  const waPhoneNumber = phoneNumber.replace(/^\+/, "");

  let messagePayload: any;

  if (request.payload.template_name) {
    // Use WhatsApp template
    messagePayload = {
      messaging_product: "whatsapp",
      to: waPhoneNumber,
      type: "template",
      template: {
        name: request.payload.template_name,
        language: { code: conversation.locale || "en" },
        components: request.payload.template_params
          ? [
            {
              type: "body",
              parameters: Object.values(request.payload.template_params).map(
                (v) => ({ type: "text", text: v }),
              ),
            },
          ]
          : [],
      },
    };
  } else {
    // Send text message
    const message = request.payload.message ||
      getDefaultMessage(request.notification_type, conversation.locale);

    messagePayload = {
      messaging_product: "whatsapp",
      to: waPhoneNumber,
      type: "text",
      text: {
        preview_url: true,
        body: message,
      },
    };
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${WABA_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WABA_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify(messagePayload),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp API error: ${error}`);
  }

  const result = await response.json();
  return {
    success: true,
    message_id: result.messages?.[0]?.id,
  };
}

async function sendPWAPushNotification(
  conversation: any,
  request: NotifyRequest,
  correlationId: string,
): Promise<{ success: boolean; message_id?: string }> {
  // TODO: Implement PWA push notification via web push API
  // For now, create a notification record in the database
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase.from("notifications").insert({
    profile_id: conversation.profile_id,
    type: request.notification_type,
    title: request.payload.title ||
      getDefaultTitle(request.notification_type, conversation.locale),
    message: request.payload.message ||
      getDefaultMessage(request.notification_type, conversation.locale),
    deep_link: request.payload.deep_link,
    read: false,
  }).select().single();

  if (error) throw error;

  return {
    success: true,
    message_id: data.id,
  };
}

  // Implement SMS via MTN provider
  const { sendSMSWithRetry, validateRwandaPhone } = await import(
    "../_shared/notifications/sms-provider.ts"
  );

  const phoneNumber = conversation.profiles?.phone;
  if (!phoneNumber) {
    throw new Error("No phone number found for user");
  }

  // Validate and normalize phone number
  const phoneValidation = validateRwandaPhone(phoneNumber);
  if (!phoneValidation.valid) {
    throw new Error(phoneValidation.error || "Invalid phone number");
  }

  const message =
    request.payload.message ||
    getDefaultMessage(request.notification_type, conversation.locale);

  // Get SMS configuration from environment
  const smsConfig = {
    apiKey: Deno.env.get("MTN_SMS_API_KEY") || "",
    apiSecret: Deno.env.get("MTN_SMS_API_SECRET") || "",
    senderId: Deno.env.get("MTN_SMS_SENDER_ID") || "easyMO",
  };

  // Send SMS with retry
  const result = await sendSMSWithRetry(
    smsConfig,
    {
      to: phoneValidation.normalized!,
      message: message.substring(0, 160), // Limit to single SMS
      reference: correlationId,
    },
    3 // Max 3 retries
  );

  if (!result.success) {
    throw new Error(`SMS send failed: ${result.error}`);
  }

  console.log(
    JSON.stringify({
      event: "SMS_SENT",
      correlationId,
      messageId: result.messageId,
      cost: result.cost,
    })
  );

  return {
    success: true,
    message_id: result.messageId,
  };

function getDefaultTitle(
  type: string,
  locale: string = "en",
): string {
  const titles: Record<string, Record<string, string>> = {
    shortlist_ready: {
      en: "Your Property Shortlist is Ready! 🏠",
      fr: "Votre sélection de propriétés est prête! 🏠",
      es: "¡Tu lista corta de propiedades está lista! 🏠",
    },
    owner_replied: {
      en: "Property Owner Responded 📱",
      fr: "Le propriétaire a répondu 📱",
      es: "El propietario respondió 📱",
    },
    viewing_scheduled: {
      en: "Viewing Scheduled 📅",
      fr: "Visite programmée 📅",
      es: "Visita programada 📅",
    },
  };

  return titles[type]?.[locale] || titles[type]?.en || "Property Update";
}

function getDefaultMessage(
  type: string,
  locale: string = "en",
): string {
  const messages: Record<string, Record<string, string>> = {
    shortlist_ready: {
      en:
        "Great news! We've found the best properties matching your requirements. Check your shortlist now to view the top 5 options.",
      fr:
        "Bonne nouvelle! Nous avons trouvé les meilleures propriétés correspondant à vos critères. Consultez votre sélection maintenant pour voir les 5 meilleures options.",
      es:
        "¡Buenas noticias! Hemos encontrado las mejores propiedades que coinciden con sus requisitos. Consulte su lista corta ahora para ver las 5 mejores opciones.",
    },
    owner_replied: {
      en:
        "The property owner has responded to your inquiry. Check the conversation for details.",
      fr:
        "Le propriétaire a répondu à votre demande. Consultez la conversation pour plus de détails.",
      es:
        "El propietario ha respondido a su consulta. Consulte la conversación para obtener más detalles.",
    },
  };

  return messages[type]?.[locale] || messages[type]?.en || "You have a new property update.";
}
