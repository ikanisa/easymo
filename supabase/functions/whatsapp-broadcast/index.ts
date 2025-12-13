/**
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
        request_id: requestId,
        user_location_label: userLocationLabel,
        need_description: needDescription,
        status: "pending"
      })
      .select()
      .single();

    if (broadcastError) {
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
