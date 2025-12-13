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

 * WhatsApp Broadcast Function
 * 
 * Sends bulk WhatsApp messages to opted-in vendors using WhatsApp Cloud Business API.
 * 
 * Features:
 * - API key authentication
 * - Opt-in/opt-out compliance checking
 * - Regional filtering (exclude blocked countries)
 * - Template message support
 * - Database logging
 * - Structured observability
 * 
 * IMPORTANT: Uses WhatsApp Cloud Business API (NOT Twilio) per GROUND_RULES.md
 * 
 * @see docs/GROUND_RULES.md
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
import { isBlockedCountry, getCountryFromPhone, normalizePhoneNumber } from "../_shared/buy-sell-config.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface BroadcastRequest {
  requestId: string;
  userLocationLabel?: string;
  needDescription: string;
  vendorFilter?: {
    tags?: string[];
    minRating?: number;
    maxDistance?: number;
  };
}

interface BroadcastTarget {
  businessName: string;
  businessPhone: string;
  countryCode?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    // Authenticate request
    const apiKey = req.headers.get("x-api-key");
    const expectedApiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

    if (!apiKey || apiKey !== expectedApiKey) {
      await logStructuredEvent("BROADCAST_AUTH_FAILED", {
        correlationId,
        hasKey: !!apiKey
      }, "error");

      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: BroadcastRequest = await req.json();
    const { requestId, userLocationLabel, needDescription, vendorFilter } = body;

    if (!requestId || !needDescription) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: requestId, needDescription" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await logStructuredEvent("BROADCAST_STARTED", {
      requestId,
      correlationId,
      hasFilter: !!vendorFilter
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create broadcast request record
    const { data: broadcastRecord, error: broadcastError } = await supabase
      .from("whatsapp_broadcast_requests")
      .insert({
        request_id: payload.request_id,
        user_location_label: payload.user_location_label,
        need_description: payload.need_description,
        status: "processing",
        request_id: requestId,
        user_location_label: userLocationLabel,
        need_description: needDescription,
        status: "pending"
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
      throw new Error(`Failed to create broadcast record: ${broadcastError.message}`);
    }

    // Query opted-in vendors
    let vendorsQuery = supabase
      .from("vendors")
      .select("id, business_name, phone, tags, average_rating, is_opted_in, is_onboarded")
      .eq("is_opted_in", true);

    // Apply filters
    if (vendorFilter?.tags && vendorFilter.tags.length > 0) {
      vendorsQuery = vendorsQuery.contains("tags", vendorFilter.tags);
    }

    if (vendorFilter?.minRating) {
      vendorsQuery = vendorsQuery.gte("average_rating", vendorFilter.minRating);
    }

    const { data: vendors, error: vendorsError } = await vendorsQuery;

    if (vendorsError) {
      throw new Error(`Failed to query vendors: ${vendorsError.message}`);
    }

    if (!vendors || vendors.length === 0) {
      await logStructuredEvent("BROADCAST_NO_VENDORS", {
        requestId,
        correlationId
      }, "warn");

      await supabase
        .from("whatsapp_broadcast_requests")
        .update({ status: "completed" })
        .eq("id", broadcastRecord.id);

      return new Response(
        JSON.stringify({
          success: true,
          requestId,
          sentCount: 0,
          errorCount: 0,
          message: "No eligible vendors found"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out blocked countries
    const eligibleVendors = vendors.filter(vendor => {
      const country = getCountryFromPhone(vendor.phone);
      return country && !isBlockedCountry(country);
    });

    await logStructuredEvent("BROADCAST_VENDORS_FILTERED", {
      requestId,
      totalVendors: vendors.length,
      eligibleVendors: eligibleVendors.length,
      correlationId
    });

    // WhatsApp Cloud Business API configuration
    const waPhoneId = Deno.env.get("WA_PHONE_ID");
    const waToken = Deno.env.get("WA_TOKEN");
    const templateName = Deno.env.get("WA_TEMPLATE_VENDOR_OUTREACH") || "vendor_outreach";

    if (!waPhoneId || !waToken) {
      throw new Error("WhatsApp Cloud API not configured (WA_PHONE_ID, WA_TOKEN)");
    }

    // Send messages and track results
    let sentCount = 0;
    let errorCount = 0;
    const targets: Array<Partial<BroadcastTarget> & { status: string; message_sid?: string; error?: string }> = [];

    for (const vendor of eligibleVendors) {
      const normalizedPhone = normalizePhoneNumber(vendor.phone);
      const country = getCountryFromPhone(normalizedPhone);

      try {
        // Send via WhatsApp Cloud Business API
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${waPhoneId}/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${waToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              // WhatsApp Cloud API expects international format without '+' prefix
              // e.g., "250788123456" not "+250788123456"
              to: normalizedPhone.replace(/^\+/, ""),
              type: "template",
              template: {
                name: templateName,
                language: {
                  code: "en"
                },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: vendor.business_name },
                      { type: "text", text: needDescription }
                    ]
                  }
                ]
              }
            })
          }
        );

        if (response.ok) {
          const result = await response.json();
          sentCount++;
          
          targets.push({
            businessName: vendor.business_name,
            businessPhone: normalizedPhone,
            countryCode: country || undefined,
            status: "sent",
            message_sid: result.messages?.[0]?.id
          });

          await logStructuredEvent("BROADCAST_MESSAGE_SENT", {
            requestId,
            businessName: vendor.business_name,
            country,
            correlationId
          });
        } else {
          const errorText = await response.text();
          errorCount++;
          
          targets.push({
            businessName: vendor.business_name,
            businessPhone: normalizedPhone,
            countryCode: country || undefined,
            status: "failed",
            error: `HTTP ${response.status}: ${errorText}`
          });

          await logStructuredEvent("BROADCAST_MESSAGE_FAILED", {
            requestId,
            businessName: vendor.business_name,
            error: errorText,
            correlationId
          }, "error");
        }
      } catch (error) {
        errorCount++;
        
        targets.push({
          businessName: vendor.business_name,
          businessPhone: normalizedPhone,
          countryCode: country || undefined,
          status: "failed",
          error: (error as Error).message
        });

        await logStructuredEvent("BROADCAST_MESSAGE_ERROR", {
          requestId,
          businessName: vendor.business_name,
          error: (error as Error).message,
          correlationId
        }, "error");
      }
    }

    // Save broadcast targets to database
    if (targets.length > 0) {
      const targetRecords = targets.map(target => ({
        broadcast_id: broadcastRecord.id,
        business_name: target.businessName,
        business_phone: target.businessPhone,
        country_code: target.countryCode,
        status: target.status,
        twilio_message_sid: target.message_sid // Keep column name for compatibility
      }));

      await supabase
        .from("whatsapp_broadcast_targets")
        .insert(targetRecords);
    }

    // Update broadcast request status
    await supabase
      .from("whatsapp_broadcast_requests")
      .update({ 
        status: errorCount === 0 ? "completed" : "sent"
      })
      .eq("id", broadcastRecord.id);

    await logStructuredEvent("BROADCAST_COMPLETED", {
      requestId,
      sentCount,
      errorCount,
      totalVendors: eligibleVendors.length,
      correlationId
    });

    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        sentCount,
        errorCount,
        totalVendors: eligibleVendors.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    await logStructuredEvent("BROADCAST_ERROR", {
      error: (error as Error).message,
      stack: (error as Error).stack,
      correlationId
    }, "error");

    return new Response(
      JSON.stringify({ 
        error: "Broadcast failed",
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
