/**
 * WhatsApp Broadcast Edge Function
 * 
 * Sends broadcast messages to vendors using WhatsApp Cloud Business API (NOT Twilio)
 * 
 * Features:
 * - Vendor opt-in/opt-out compliance
 * - Regional filtering (blocks UG, KE, NG, ZA)
 * - Template-based messaging
 * - Database logging to whatsapp_broadcast_requests and whatsapp_broadcast_targets
 * 
 * IMPORTANT: This uses WhatsApp Cloud Business API per ground rules (Twilio is prohibited)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { isCountryBlocked, detectCountryFromPhone, maskPhone } from "../_shared/buy-sell-config.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

interface BroadcastRequest {
  request_id: string;
  need_description: string;
  user_location_label?: string;
  target_vendors?: Array<{
    business_name: string;
    business_phone: string;
    country_code?: string;
  }>;
  vendor_filter?: {
    country_codes?: string[];
    tags?: string[];
    min_rating?: number;
  };
}

serve(async (req: Request): Promise<Response> => {
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", "whatsapp-broadcast");
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Health check
  if (req.method === "GET") {
    return respond({
      status: "healthy",
      service: "whatsapp-broadcast",
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  try {
    const payload: BroadcastRequest = await req.json();

    if (!payload.request_id || !payload.need_description) {
      return respond(
        { error: "Missing required fields: request_id, need_description" },
        { status: 400 }
      );
    }

    await logStructuredEvent("BROADCAST_REQUEST_RECEIVED", {
      request_id: payload.request_id,
      correlationId,
    });

    // Create broadcast request record
    const { data: broadcastRecord, error: broadcastError } = await supabase
      .from("whatsapp_broadcast_requests")
      .insert({
        request_id: payload.request_id,
        user_location_label: payload.user_location_label,
        need_description: payload.need_description,
        status: "processing",
      })
      .select()
      .single();

    if (broadcastError) {
      await logStructuredEvent("BROADCAST_REQUEST_FAILED", {
        error: broadcastError.message,
        correlationId,
      });
      return respond({ error: broadcastError.message }, { status: 500 });
    }

    // Get target vendors
    let targetVendors = payload.target_vendors || [];

    // If no specific targets, query database with filters
    if (targetVendors.length === 0) {
      let query = supabase
        .from("vendors")
        .select("business_name, phone, country_code")
        .eq("is_opted_in", true);

      if (payload.vendor_filter) {
        if (payload.vendor_filter.country_codes) {
          query = query.in("country_code", payload.vendor_filter.country_codes);
        }
        if (payload.vendor_filter.min_rating) {
          query = query.gte("average_rating", payload.vendor_filter.min_rating);
        }
      }

      const { data: vendors, error: vendorError } = await query;

      if (vendorError) {
        await logStructuredEvent("VENDOR_QUERY_FAILED", {
          error: vendorError.message,
          correlationId,
        });
        return respond({ error: vendorError.message }, { status: 500 });
      }

      targetVendors = vendors.map((v: any) => ({
        business_name: v.business_name,
        business_phone: v.phone,
        country_code: v.country_code,
      }));
    }

    // Filter out opted-out vendors
    const { data: optOuts } = await supabase
      .from("whatsapp_opt_outs")
      .select("business_phone");

    const optOutPhones = new Set(optOuts?.map((o: any) => o.business_phone) || []);

    // Filter vendors: remove opted-out and blocked countries
    const filteredVendors = targetVendors.filter((vendor) => {
      // Check opt-out
      if (optOutPhones.has(vendor.business_phone)) {
        return false;
      }

      // Check blocked country
      const countryCode = vendor.country_code || detectCountryFromPhone(vendor.business_phone);
      if (countryCode && isCountryBlocked(countryCode)) {
        return false;
      }

      return true;
    });

    await logStructuredEvent("BROADCAST_VENDORS_FILTERED", {
      total: targetVendors.length,
      filtered: filteredVendors.length,
      optedOut: targetVendors.length - filteredVendors.length,
      correlationId,
    });

    // Send messages via WhatsApp Cloud Business API
    const sendResults = [];

    for (const vendor of filteredVendors) {
      try {
        // Create broadcast target record
        const { data: targetRecord, error: targetError } = await supabase
          .from("whatsapp_broadcast_targets")
          .insert({
            broadcast_id: broadcastRecord.id,
            business_name: vendor.business_name,
            business_phone: vendor.business_phone,
            country_code: vendor.country_code,
            status: "pending",
          })
          .select()
          .single();

        if (targetError) {
          await logStructuredEvent("BROADCAST_TARGET_CREATE_FAILED", {
            phone: maskPhone(vendor.business_phone),
            error: targetError.message,
            correlationId,
          });
          continue;
        }

        // Send WhatsApp message via Cloud Business API
        const message = `📢 *New Inquiry*\n\n${payload.need_description}\n\n${
          payload.user_location_label ? `📍 Location: ${payload.user_location_label}\n\n` : ""
        }Reply:\n• *HAVE IT* - if you have this\n• *NO STOCK* - if you don't\n• *STOP* - to unsubscribe`;

        const response = await fetch(WHATSAPP_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: vendor.business_phone,
            type: "text",
            text: {
              body: message,
            },
          }),
        });

        const result = await response.json();

        if (response.ok && result.messages?.[0]?.id) {
          // Update target record with success
          await supabase
            .from("whatsapp_broadcast_targets")
            .update({
              status: "sent",
              message_sid: result.messages[0].id,
            })
            .eq("id", targetRecord.id);

          sendResults.push({
            phone: maskPhone(vendor.business_phone),
            status: "sent",
            message_id: result.messages[0].id,
          });

          await recordMetric("whatsapp.broadcast.sent", 1, {
            country: vendor.country_code,
          });
        } else {
          // Update target record with failure
          await supabase
            .from("whatsapp_broadcast_targets")
            .update({
              status: "failed",
            })
            .eq("id", targetRecord.id);

          sendResults.push({
            phone: maskPhone(vendor.business_phone),
            status: "failed",
            error: result.error?.message || "Unknown error",
          });

          await logStructuredEvent("WHATSAPP_SEND_FAILED", {
            phone: maskPhone(vendor.business_phone),
            error: result.error?.message,
            correlationId,
          });
        }
      } catch (error) {
        await logStructuredEvent("BROADCAST_SEND_ERROR", {
          phone: maskPhone(vendor.business_phone),
          error: error.message,
          correlationId,
        });

        sendResults.push({
          phone: maskPhone(vendor.business_phone),
          status: "error",
          error: error.message,
        });
      }
    }

    // Update broadcast request status
    await supabase
      .from("whatsapp_broadcast_requests")
      .update({ status: "completed" })
      .eq("id", broadcastRecord.id);

    await logStructuredEvent("BROADCAST_COMPLETED", {
      request_id: payload.request_id,
      total_sent: sendResults.filter((r) => r.status === "sent").length,
      total_failed: sendResults.filter((r) => r.status !== "sent").length,
      correlationId,
    });

    return respond({
      success: true,
      request_id: payload.request_id,
      broadcast_id: broadcastRecord.id,
      total_targeted: filteredVendors.length,
      results: sendResults,
    });
  } catch (error) {
    await logStructuredEvent("BROADCAST_ERROR", {
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
