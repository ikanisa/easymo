/**
 * MomoTerminal SMS Webhook Handler
 * Receives Mobile Money SMS from MomoTerminal Android app
 * Routes to appropriate service matchers (rides, marketplace, jobs, insurance)
 *
 * Ground Rules Compliance:
 * - Structured logging with correlation IDs
 * - PII masking for phone numbers
 * - HMAC signature verification
 * - Rate limiting
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { parseMomoSms } from "./utils/sms-parser.ts";
import { verifyHmacSignature } from "./utils/hmac.ts";
import { matchRidePayment } from "./matchers/rides.ts";
import { matchMarketplacePayment } from "./matchers/marketplace.ts";
import { matchJobPayment } from "./matchers/jobs.ts";
import { matchInsurancePayment } from "./matchers/insurance.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-momo-signature, x-momo-timestamp, x-momo-device-id, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// PII masking helper (Ground Rules compliant)
function maskPhone(phone: string): string {
  return phone.replace(/(\+\d{3})\d+(\d{4})/, "$1****$2");
}

interface MomoSmsPayload {
  source: "momoterminal";
  version: string;
  timestamp: string;
  phone_number: string;
  sender: string;
  message: string;
  device_id: string;
}

serve(async (req: Request): Promise<Response> => {
  const correlationId =
    req.headers.get("x-correlation-id") || crypto.randomUUID();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Extract and validate headers
    const signature = req.headers.get("x-momo-signature");
    const timestamp = req.headers.get("x-momo-timestamp");
    const deviceId = req.headers.get("x-momo-device-id");

    if (!signature || !timestamp) {
      await logStructuredEvent("MOMO_WEBHOOK_MISSING_HEADERS", {
        correlationId,
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
      });
      return new Response(
        JSON.stringify({ error: "Missing required headers" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check timestamp freshness (5 minute window - replay protection)
    const requestTime = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - requestTime) > 300) {
      await logStructuredEvent("MOMO_WEBHOOK_EXPIRED_REQUEST", {
        correlationId,
        requestTime,
        serverTime: now,
        diff: Math.abs(now - requestTime),
      });
      await recordMetric("momo.webhook.expired", 1);
      return new Response(
        JSON.stringify({ error: "Request expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Parse request body
    const rawBody = await req.text();
    let payload: MomoSmsPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      await logStructuredEvent("MOMO_WEBHOOK_INVALID_JSON", { correlationId });
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validate payload structure
    if (payload.source !== "momoterminal" || !payload.phone_number || !payload.message) {
      await logStructuredEvent("MOMO_WEBHOOK_INVALID_PAYLOAD", {
        correlationId,
        source: payload.source,
        hasPhone: !!payload.phone_number,
        hasMessage: !!payload.message,
      });
      return new Response(
        JSON.stringify({ error: "Invalid payload structure" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 6. Get webhook config for this phone number
    const { data: endpoint, error: endpointError } = await supabase
      .from("momo_webhook_endpoints")
      .select("*")
      .eq("momo_phone_number", payload.phone_number)
      .eq("is_active", true)
      .single();

    if (endpointError || !endpoint) {
      await logStructuredEvent("MOMO_WEBHOOK_UNKNOWN_PHONE", {
        correlationId,
        phone: maskPhone(payload.phone_number),
      });
      await recordMetric("momo.webhook.unknown_phone", 1);
      return new Response(
        JSON.stringify({ error: "Webhook not configured for this phone" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Verify HMAC signature
    const isValidSignature = await verifyHmacSignature(
      rawBody,
      signature,
      endpoint.webhook_secret
    );

    if (!isValidSignature) {
      await logStructuredEvent("MOMO_WEBHOOK_INVALID_SIGNATURE", {
        correlationId,
        phone: maskPhone(payload.phone_number),
        serviceType: endpoint.service_type,
      });
      await recordMetric("momo.webhook.invalid_signature", 1, { service: endpoint.service_type });
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Parse SMS content
    const parsed = parseMomoSms(payload.message);

    await logStructuredEvent("MOMO_SMS_RECEIVED", {
      correlationId,
      phone: maskPhone(payload.phone_number),
      serviceType: endpoint.service_type,
      provider: parsed.provider,
      amount: parsed.amount,
      hasTxnId: !!parsed.transactionId,
    });
    await recordMetric("momo.sms.received", 1, { 
      service: endpoint.service_type,
      provider: parsed.provider || "unknown" 
    });

    // 9. Insert transaction record
    const { data: transaction, error: insertError } = await supabase
      .from("momo_transactions")
      .insert({
        phone_number: payload.phone_number,
        sender: payload.sender,
        raw_message: payload.message,
        amount: parsed.amount,
        sender_name: parsed.senderName,
        transaction_id: parsed.transactionId,
        provider: parsed.provider || "unknown",
        service_type: endpoint.service_type,
        status: "pending",
        correlation_id: correlationId,
        device_id: deviceId || payload.device_id,
        signature: signature,
        received_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      await logStructuredEvent("MOMO_WEBHOOK_INSERT_ERROR", {
        correlationId,
        error: insertError.message,
        phone: maskPhone(payload.phone_number),
      });
      return new Response(
        JSON.stringify({ error: "Failed to store transaction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 10. Route to appropriate service matcher
    let matchResult = null;
    const serviceType = endpoint.service_type;

    try {
      switch (serviceType) {
        case "rides":
          matchResult = await matchRidePayment(supabase, transaction, correlationId);
          break;
        case "marketplace":
          matchResult = await matchMarketplacePayment(supabase, transaction, correlationId);
          break;
        case "jobs":
          matchResult = await matchJobPayment(supabase, transaction, correlationId);
          break;
        case "insurance":
          matchResult = await matchInsurancePayment(supabase, transaction, correlationId);
          break;
        default:
          await logStructuredEvent("MOMO_WEBHOOK_UNKNOWN_SERVICE", {
            correlationId,
            serviceType,
          });
      }
    } catch (matchError) {
      await logStructuredEvent("MOMO_MATCHER_ERROR", {
        correlationId,
        serviceType,
        error: matchError instanceof Error ? matchError.message : String(matchError),
      });
      // Continue - we still stored the transaction
    }

    // 11. Update transaction with match result
    const updatePayload: Record<string, unknown> = {
      processed_at: new Date().toISOString(),
    };

    if (matchResult) {
      updatePayload.status = "matched";
      updatePayload.matched_record_id = matchResult.id;
      updatePayload.matched_table = matchResult.table;
      updatePayload.match_confidence = matchResult.confidence;

      await recordMetric("momo.payment.matched", 1, { service: serviceType });
    } else {
      updatePayload.status = "manual_review";
      await recordMetric("momo.payment.unmatched", 1, { service: serviceType });
    }

    await supabase
      .from("momo_transactions")
      .update(updatePayload)
      .eq("id", transaction.id);

    await logStructuredEvent("MOMO_WEBHOOK_COMPLETE", {
      correlationId,
      transactionId: transaction.id,
      serviceType,
      matched: !!matchResult,
      matchConfidence: matchResult?.confidence,
    });

    // 12. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        id: transaction.id,
        service: serviceType,
        matched: matchResult !== null,
        matchedTo: matchResult?.table,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    await logStructuredEvent("MOMO_WEBHOOK_FATAL_ERROR", {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    await recordMetric("momo.webhook.error", 1);

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
