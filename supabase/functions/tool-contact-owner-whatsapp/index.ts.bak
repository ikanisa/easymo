// Tool: Contact Owner WhatsApp
// Initiates WhatsApp communication with property owners
// Handles template messaging and outreach tracking

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WABA_PHONE_NUMBER_ID = Deno.env.get("WABA_PHONE_NUMBER_ID")!;
const WABA_ACCESS_TOKEN = Deno.env.get("WABA_ACCESS_TOKEN")!;

interface ContactOwnerRequest {
  request_id: string;
  listing_id: string;
  locale?: string;
  message?: string;
  template_id?: string;
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
    const request: ContactOwnerRequest = await req.json();

    console.log(
      JSON.stringify({
        event: "CONTACT_OWNER_START",
        correlationId,
        requestId: request.request_id,
        listingId: request.listing_id,
        timestamp: new Date().toISOString(),
      }),
    );

    // Get listing details
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("*, profiles!owner_profile_id(*)")
      .eq("id", request.listing_id)
      .single();

    if (listingError) throw listingError;
    if (!listing) throw new Error("Listing not found");

    // Get property request details
    const { data: propertyRequest, error: requestError } = await supabase
      .from("property_requests")
      .select("*, profiles!user_profile_id(*)")
      .eq("id", request.request_id)
      .single();

    if (requestError) throw requestError;

    // Get or determine owner contact
    const ownerPhone = listing.owner_contact?.phone ||
      listing.profiles?.phone;
    if (!ownerPhone) {
      throw new Error("No contact information for property owner");
    }

    // Build message
    const locale = request.locale || propertyRequest.language || "en";
    const message = request.message ||
      buildDefaultMessage(listing, propertyRequest, locale);

    // Send WhatsApp message
    const waPhoneNumber = ownerPhone.replace(/^\+/, "");
    const messagePayload = {
      messaging_product: "whatsapp",
      to: waPhoneNumber,
      type: "text",
      text: {
        preview_url: false,
        body: message,
      },
    };

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
    const messageId = result.messages?.[0]?.id;

    // Create owner_outreach record
    const { data: outreach, error: outreachError } = await supabase
      .from("owner_outreach")
      .insert({
        request_id: request.request_id,
        listing_id: request.listing_id,
        owner_profile_id: listing.owner_profile_id,
        channel: "whatsapp",
        last_status: "sent",
        message_id: messageId,
        sent_at: new Date().toISOString(),
        transcript: [{
          timestamp: new Date().toISOString(),
          direction: "outbound",
          message: message,
          message_id: messageId,
        }],
      })
      .select()
      .single();

    if (outreachError) throw outreachError;

    // Log metric
    await supabase.from("analytics_events").insert({
      event_type: "property.owner_contacted",
      event_data: {
        request_id: request.request_id,
        listing_id: request.listing_id,
        channel: "whatsapp",
        outreach_id: outreach.id,
      },
    });

    console.log(
      JSON.stringify({
        event: "CONTACT_OWNER_COMPLETE",
        correlationId,
        requestId: request.request_id,
        outreachId: outreach.id,
        messageId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }),
    );

    return new Response(
      JSON.stringify({
        success: true,
        outreach_id: outreach.id,
        message_id: messageId,
        owner_phone: maskPhone(ownerPhone),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "CONTACT_OWNER_ERROR",
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

function buildDefaultMessage(
  listing: any,
  request: any,
  locale: string,
): string {
  const templates: Record<string, string> = {
    en: `Hello! I'm interested in your ${listing.property_type} at ${listing.address}.\n\n` +
      `Property details:\n` +
      `• ${listing.bedrooms} bedroom(s)\n` +
      `• ${listing.price_amount} ${listing.price_currency}/${listing.price_unit.replace("per_", "")}\n\n` +
      `I'm looking for a ${request.stay_kind.replace("_", "-")} rental starting ${
        request.start_date ? new Date(request.start_date).toLocaleDateString() : "soon"
      }.\n\n` +
      `Is this property still available? I'd love to learn more or schedule a viewing.`,

    fr: `Bonjour! Je suis intéressé(e) par votre ${listing.property_type} à ${listing.address}.\n\n` +
      `Détails de la propriété:\n` +
      `• ${listing.bedrooms} chambre(s)\n` +
      `• ${listing.price_amount} ${listing.price_currency}/${listing.price_unit.replace("per_", "")}\n\n` +
      `Je cherche une location ${request.stay_kind.replace("_", "-")} à partir du ${
        request.start_date ? new Date(request.start_date).toLocaleDateString() : "bientôt"
      }.\n\n` +
      `Cette propriété est-elle toujours disponible? J'aimerais en savoir plus ou programmer une visite.`,

    es: `¡Hola! Estoy interesado/a en su ${listing.property_type} en ${listing.address}.\n\n` +
      `Detalles de la propiedad:\n` +
      `• ${listing.bedrooms} dormitorio(s)\n` +
      `• ${listing.price_amount} ${listing.price_currency}/${listing.price_unit.replace("per_", "")}\n\n` +
      `Busco un alquiler ${request.stay_kind.replace("_", "-")} a partir del ${
        request.start_date ? new Date(request.start_date).toLocaleDateString() : "pronto"
      }.\n\n` +
      `¿Esta propiedad todavía está disponible? Me encantaría saber más o programar una visita.`,
  };

  return templates[locale] || templates["en"];
}

function maskPhone(phone: string): string {
  // Mask phone number for privacy (show first 3 and last 4 digits)
  if (phone.length <= 7) return phone;
  const prefix = phone.substring(0, 3);
  const suffix = phone.substring(phone.length - 4);
  return `${prefix}****${suffix}`;
}
