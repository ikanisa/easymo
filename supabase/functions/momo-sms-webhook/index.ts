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
import { checkRateLimit, cleanupRateLimitState } from "../_shared/service-resilience.ts";
import { 
  withWebhookErrorBoundary, 
  ValidationError, 
  AuthenticationError,
  ProcessingError,
  type WebhookErrorContext 
} from "../_shared/webhook-error-boundary.ts";
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

// Rate limit configuration (configurable via environment variables)
const RATE_LIMIT_MAX = parseInt(Deno.env.get("MOMO_SMS_RATE_LIMIT_MAX") || "100", 10);
const RATE_LIMIT_WINDOW_SECONDS = parseInt(Deno.env.get("MOMO_SMS_RATE_LIMIT_WINDOW") || "60", 10);

// Request counter for periodic cleanup
let requestCounter = 0;
const CLEANUP_INTERVAL = 50;

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

serve(withWebhookErrorBoundary(
  async (req: Request): Promise<Response> => {
    const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
    const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
    
    requestCounter++;

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // Only accept POST
    if (req.method !== "POST") {
      throw new ValidationError("Method not allowed. Only POST is accepted.");
    }

    // 1. Extract and validate headers
    const signature = req.headers.get("x-momo-signature");
    const timestamp = req.headers.get("x-momo-timestamp");
    const deviceId = req.headers.get("x-momo-device-id");
    
    // 1a. Rate limiting by device ID or IP
    const rateLimitKey = deviceId || req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const rateCheck = checkRateLimit(rateLimitKey);
    
    if (!rateCheck.allowed) {
      await logStructuredEvent("MOMO_WEBHOOK_RATE_LIMITED", {
        correlationId,
        deviceId,
        resetAt: new Date(rateCheck.resetAt).toISOString(),
      });
      await recordMetric("momo.webhook.rate_limited", 1);
      return new Response(
        JSON.stringify({
          error: "rate_limit_exceeded",
          retryAfter: Math.ceil((rateCheck.resetAt - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
            "X-RateLimit-Remaining": String(rateCheck.remaining),
            "X-RateLimit-Reset": new Date(rateCheck.resetAt).toISOString(),
          },
        }
      );
    }
    
    // Periodic cleanup of rate limit state
    if (requestCounter % CLEANUP_INTERVAL === 0) {
      cleanupRateLimitState();
    }

    if (!signature || !timestamp) {
      throw new AuthenticationError("Missing required headers: x-momo-signature or x-momo-timestamp");
    }

    // 2. Check timestamp freshness (5 minute window - replay protection)
    const requestTime = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - requestTime) > 300) {
      throw new AuthenticationError(`Request expired. Time difference: ${Math.abs(now - requestTime)}s`);
    }

    // 3. Parse request body
    const rawBody = await req.text();
    let payload: MomoSmsPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new ValidationError("Invalid JSON payload");
    }

    // 4. Validate payload structure
    if (payload.source !== "momoterminal" || !payload.phone_number || !payload.message) {
      throw new ValidationError("Invalid payload structure. Required: source=momoterminal, phone_number, message");
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
      throw new AuthenticationError(`Webhook not configured for phone: ${maskPhone(payload.phone_number)}`);
    }

    // 7. Verify HMAC signature
    const isValidSignature = await verifyHmacSignature(
      rawBody,
      signature,
      endpoint.webhook_secret
    );

    if (!isValidSignature) {
      throw new AuthenticationError("Invalid HMAC signature");
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
      throw new ProcessingError(`Failed to store transaction: ${insertError.message}`);
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Correlation-ID": correlationId } }
    );
  },
  (req: Request): WebhookErrorContext => ({
    service: "momo-sms-webhook",
    correlationId: req.headers.get("x-correlation-id") || crypto.randomUUID(),
    requestId: req.headers.get("x-request-id") || crypto.randomUUID(),
    phoneNumber: undefined, // Will be extracted from payload
    ipAddress: req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0],
    userAgent: req.headers.get("user-agent") || undefined,
  }),
  {
    enableDLQ: true,
    enableRetry: true,
    maxRetries: 3,
    userFriendlyMessages: true,
    notifyUser: false,
  }
));
