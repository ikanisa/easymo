/**
 * Vendor Outreach & Broadcasting
 * 
 * Handles WhatsApp broadcasting to vendors using Meta WhatsApp API
 * Includes:
 * - Rate limiting (1 hour window per vendor)
 * - Opt-in/opt-out checking
 * - Broadcast request management
 * - Vendor response handling
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

import { logStructuredEvent, recordMetric } from "../observability.ts";
import type { BroadcastRequest, BroadcastTarget, VendorCandidate } from "../types/buy-sell.ts";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const EXCLUDED_COUNTRIES = ["UG", "KE", "NG", "ZA"];

/**
 * Broadcast to vendors via Meta WhatsApp API
 * 
 * @param requestId - Sourcing request ID
 * @param userLocationLabel - User's location description
 * @param needDescription - Description of what user needs
 * @param candidates - Vendor candidates to contact
 * @param supabase - Supabase client
 * @param correlationId - Correlation ID for logging
 */
export async function broadcastToVendors(
  requestId: string,
  userLocationLabel: string,
  needDescription: string,
  candidates: VendorCandidate[],
  supabase: SupabaseClient,
  correlationId?: string
): Promise<{
  broadcastId: string;
  totalBusinesses: number;
  sent: number;
  errors: number;
  rateLimited: number;
}> {
  const startTime = Date.now();

  try {
    // 1. Create broadcast request record
    const { data: requestRecord, error: reqErr } = await supabase
      .from("whatsapp_broadcast_requests")
      .insert({
        request_id: requestId,
        user_location_label: userLocationLabel,
        need_description: needDescription,
        status: "processing",
      })
      .select("id")
      .single();

    if (reqErr || !requestRecord) {
      throw new Error(`Failed to create broadcast request: ${reqErr?.message || "Unknown error"}`);
    }

    let sentCount = 0;
    let errorCount = 0;
    let rateLimitedCount = 0;
    let skippedCount = 0;

    // 2. Process each candidate
    for (const candidate of candidates) {
      // Skip if no phone number
      if (!candidate.phone) {
        skippedCount++;
        continue;
      }

      // Normalize phone number
      let cleanPhone = candidate.phone.replace("whatsapp:", "").trim();
      if (!cleanPhone.startsWith("+")) {
        cleanPhone = "+" + cleanPhone;
      }

      // Extract country code for filtering
      const countryCode = extractCountryCode(cleanPhone);
      if (countryCode && EXCLUDED_COUNTRIES.includes(countryCode.toUpperCase())) {
        skippedCount++;
        continue;
      }

      // 2a. Check Opt-out (Blacklist)
      const { data: optOut } = await supabase
        .from("whatsapp_opt_outs")
        .select("id")
        .eq("business_phone", cleanPhone)
        .maybeSingle();

      if (optOut) {
        skippedCount++;
        continue;
      }

      // 2b. Check Explicit Opt-in (Whitelist) - Only for onboarded vendors
      if (candidate.is_onboarded) {
        const { data: vendorRecord } = await supabase
          .from("vendors")
          .select("id, is_opted_in")
          .eq("phone", cleanPhone)
          .maybeSingle();

        if (!vendorRecord || !vendorRecord.is_opted_in) {
          skippedCount++;
          continue;
        }
      }

      // 2c. Vendor Rate Limiting (Prevent Spam)
      const rateLimitTime = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
      const { data: recentBroadcast } = await supabase
        .from("whatsapp_broadcast_targets")
        .select("id")
        .eq("business_phone", cleanPhone)
        .eq("status", "sent")
        .gt("created_at", rateLimitTime)
        .maybeSingle();

      if (recentBroadcast) {
        rateLimitedCount++;
        continue;
      }

      // 2d. Create target record
      const { data: target, error: targetErr } = await supabase
        .from("whatsapp_broadcast_targets")
        .insert({
          broadcast_id: requestRecord.id,
          business_name: candidate.name,
          business_phone: cleanPhone,
          country_code: countryCode,
          status: "pending",
        })
        .select("id")
        .single();

      if (targetErr || !target) {
        errorCount++;
        continue;
      }

      // 2e. Send via Meta WhatsApp API
      try {
        const success = await sendWhatsAppMessage(
          cleanPhone,
          buildVendorMessage(candidate.name, userLocationLabel, needDescription),
          correlationId
        );

        if (success) {
          await supabase
            .from("whatsapp_broadcast_targets")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
            })
            .eq("id", target.id);

          sentCount++;
          recordMetric("vendor.broadcast.sent", 1, {
            is_onboarded: candidate.is_onboarded ? "true" : "false",
          });
        } else {
          await supabase
            .from("whatsapp_broadcast_targets")
            .update({ status: "error" })
            .eq("id", target.id);
          errorCount++;
        }
      } catch (sendError) {
        logStructuredEvent("BROADCAST_SEND_ERROR", {
          phone: cleanPhone.slice(-4), // Masked
          error: sendError instanceof Error ? sendError.message : String(sendError),
          correlationId,
        }, "error");

        await supabase
          .from("whatsapp_broadcast_targets")
          .update({ status: "error" })
          .eq("id", target.id);
        errorCount++;
      }
    }

    // 3. Update request status
    await supabase
      .from("whatsapp_broadcast_requests")
      .update({ 
        status: sentCount > 0 ? "sent" : "error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestRecord.id);

    const duration = Date.now() - startTime;

    logStructuredEvent("BROADCAST_COMPLETED", {
      broadcastId: requestRecord.id,
      requestId,
      totalBusinesses: candidates.length,
      sent: sentCount,
      errors: errorCount,
      rateLimited: rateLimitedCount,
      skipped: skippedCount,
      durationMs: duration,
      correlationId,
    });

    recordMetric("vendor.broadcast.completed", 1, {
      sent_count: sentCount.toString(),
    });

    return {
      broadcastId: requestRecord.id,
      totalBusinesses: candidates.length,
      sent: sentCount,
      errors: errorCount,
      rateLimited: rateLimitedCount,
    };
  } catch (error) {
    logStructuredEvent("BROADCAST_ERROR", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, "error");

    throw error;
  }
}

/**
 * Send WhatsApp message via Meta API
 */
async function sendWhatsAppMessage(
  to: string,
  message: string,
  correlationId?: string
): Promise<boolean> {
  try {
    const getEnv = (key: string) => {
      if (typeof Deno !== "undefined") return Deno.env.get(key);
      // @ts-ignore
      return typeof process !== "undefined" ? process.env[key] : undefined;
    };

    const accessToken = getEnv("WHATSAPP_ACCESS_TOKEN") || getEnv("WA_TOKEN");
    const phoneNumberId = getEnv("WHATSAPP_PHONE_NUMBER_ID") || getEnv("WA_PHONE_NUMBER_ID");

    if (!accessToken || !phoneNumberId) {
      throw new Error("WhatsApp API credentials not configured");
    }

    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace("+", ""), // Remove + for Meta API
        type: "text",
        text: {
          body: message,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    logStructuredEvent("WHATSAPP_MESSAGE_SENT", {
      to: to.slice(-4), // Masked
      messageId: data.messages?.[0]?.id,
      correlationId,
    });

    return true;
  } catch (error) {
    logStructuredEvent("WHATSAPP_SEND_ERROR", {
      to: to.slice(-4), // Masked
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, "error");
    return false;
  }
}

/**
 * Build vendor outreach message
 */
function buildVendorMessage(
  vendorName: string,
  userLocation: string,
  needDescription: string
): string {
  return `Hello ${vendorName}! 👋

A customer near ${userLocation} is looking for:
${needDescription}

Do you have this available? Reply "HAVE IT" if you can help, or let us know if you have something similar.

Thank you! 🙏`;
}

/**
 * Extract country code from phone number
 */
function extractCountryCode(phone: string): string | null {
  // Simple extraction - can be enhanced with LPM
  const match = phone.match(/^\+(\d{1,3})/);
  if (!match) return null;

  const code = match[1];
  
  // Map common country codes
  const countryMap: Record<string, string> = {
    "250": "RW",
    "256": "UG",
    "254": "KE",
    "234": "NG",
    "27": "ZA",
    "233": "GH",
    "251": "ET",
    "255": "TZ",
  };

  return countryMap[code] || null;
}

/**
 * Handle vendor response (e.g., "HAVE IT" button)
 */
export async function handleVendorResponse(
  inquiryId: string,
  vendorId: string,
  responseText: string,
  supabase: SupabaseClient,
  correlationId?: string
): Promise<boolean> {
  try {
    // Save vendor response
    const { data: response, error } = await supabase
      .from("vendor_responses")
      .insert({
        inquiry_id: inquiryId,
        vendor_id: vendorId,
        raw_text: responseText,
        availability: responseText.toLowerCase().includes("have it") ? "available" : "unknown",
      })
      .select("id")
      .single();

    if (error) {
      logStructuredEvent("VENDOR_RESPONSE_SAVE_ERROR", {
        inquiryId,
        vendorId,
        error: error.message,
        correlationId,
      }, "error");
      return false;
    }

    // Update inquiry status
    await supabase
      .from("vendor_inquiries")
      .update({ status: "responded" })
      .eq("id", inquiryId);

    // Notify user if vendor has the item
    if (responseText.toLowerCase().includes("have it")) {
      // Get sourcing request to notify user
      const { data: inquiry } = await supabase
        .from("vendor_inquiries")
        .select("request_id, vendors(business_name, phone)")
        .eq("id", inquiryId)
        .single();

      if (inquiry) {
        // Create notification job or send directly
        logStructuredEvent("VENDOR_MATCH_FOUND", {
          inquiryId,
          vendorId,
          requestId: inquiry.request_id,
          correlationId,
        });
      }
    }

    logStructuredEvent("VENDOR_RESPONSE_HANDLED", {
      inquiryId,
      vendorId,
      responseId: response.id,
      correlationId,
    });

    return true;
  } catch (error) {
    logStructuredEvent("VENDOR_RESPONSE_HANDLE_ERROR", {
      inquiryId,
      vendorId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, "error");
    return false;
  }
}

