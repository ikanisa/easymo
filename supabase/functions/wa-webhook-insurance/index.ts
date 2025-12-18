/**
 * wa-webhook-insurance
 * 
 * Simple insurance workflow edge function:
 * User taps "Insurance" → Receives WhatsApp links to insurance agents → Contacts agents directly
 * 
 * NO admin panels, NO leads tracking, NO OCR, NO notifications
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
import { fetchInsuranceContacts, formatContactLinks } from "./handlers/contacts.ts";
import { buildInsuranceMessage } from "./utils/messages.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { claimEvent } from "../_shared/wa-webhook-shared/state/idempotency.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const serviceName = "wa-webhook-insurance";

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET" && (new URL(req.url)).pathname.endsWith("/health")) {
    return new Response(JSON.stringify({
      status: "ok",
      service: serviceName,
      timestamp: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // Basic rate limiting to prevent abuse of public endpoint
    const rate = await rateLimitMiddleware(req, { limit: 60, windowSeconds: 60 });
    if (!rate.allowed) {
      return rate.response ?? new Response(
        JSON.stringify({ error: "rate_limited" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Optional signature verification for inbound calls (if secret configured)
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ??
      Deno.env.get("WA_APP_SECRET");
    const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false")
      .toLowerCase() === "true";
    let rawBody = "";
    try {
      rawBody = await req.text();
    } catch {
      rawBody = "";
    }
    const signature = req.headers.get("x-hub-signature-256") ??
      req.headers.get("x-hub-signature") ?? "";
    const runtimeEnv = (Deno.env.get("DENO_ENV") ?? "development").toLowerCase();
    const isProd = runtimeEnv === "production" || runtimeEnv === "prod";
    if (appSecret) {
      if (!signature && isProd && !allowUnsigned) {
        await logStructuredEvent("INSURANCE_SIGNATURE_MISSING", { requestId, correlationId }, "warn");
        return new Response(
          JSON.stringify({ error: "unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (signature) {
        const valid = await verifyWebhookSignature(rawBody, signature, appSecret);
        if (!valid && !(allowUnsigned && !isProd)) {
          await logStructuredEvent("INSURANCE_SIGNATURE_INVALID", { requestId, correlationId }, "warn");
          return new Response(
            JSON.stringify({ error: "unauthorized" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    } else if (isProd && !allowUnsigned) {
      await logStructuredEvent("INSURANCE_SIGNATURE_APP_SECRET_MISSING", { requestId, correlationId }, "error");
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsedPayload: any = null;
    try {
      parsedPayload = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedPayload = null;
    }

    // Idempotency: if WhatsApp message id is present, dedupe
    try {
      const body = parsedPayload ?? {};
      const msgId = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id ??
        body?.messages?.[0]?.id ??
        body?.message?.id ??
        null;
      const from = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ??
        body?.messages?.[0]?.from ??
        body?.message?.from ??
        null;
      if (msgId) {
        const claimed = await claimEvent(String(msgId), from ?? undefined);
        if (!claimed) {
          await logStructuredEvent("INSURANCE_DUPLICATE_SKIPPED", { requestId, correlationId, msgId });
          return new Response(
            JSON.stringify({ success: true, ignored: "duplicate" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    } catch {
      // best-effort; continue on parse errors
    }

    await logStructuredEvent("INSURANCE_REQUEST_START", {
      requestId,
      correlationId,
      method: req.method,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      await logStructuredEvent("INSURANCE_CONFIG_ERROR", {
        service: serviceName,
        requestId,
        correlationId,
        error: "Missing Supabase configuration",
      }, "error");
      
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch insurance contacts using handler
    const { contacts, error } = await fetchInsuranceContacts(supabase, requestId);

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch insurance contacts" }),
        { 
          status: 503, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check if contacts are available
    if (!contacts || contacts.length === 0) {
      await logStructuredEvent("INSURANCE_NO_CONTACTS", {
        service: serviceName,
        requestId,
        correlationId,
      }, "warn");

      return new Response(
        JSON.stringify({ 
          error: "No insurance contacts available",
          message: "Please try again later or contact support."
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Format contact links using handler
    const contactLinks = await formatContactLinks(contacts, requestId);

    // Check if we have any valid contacts after filtering
    if (!contactLinks) {
      await logStructuredEvent("INSURANCE_NO_VALID_CONTACTS", {
        service: serviceName,
        requestId,
        correlationId,
        total: contacts.length,
      }, "warn");

      return new Response(
        JSON.stringify({ 
          error: "No valid insurance contacts available",
          message: "Please try again later or contact support."
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Build message using utility
    const message = buildInsuranceMessage(contactLinks);

    await logStructuredEvent("INSURANCE_SUCCESS", {
      service: serviceName,
      requestId,
      correlationId,
      contactCount: contacts.length,
      validContacts: contactLinks ? contactLinks.split("\n").length : 0,
    });

    // If invoked as a WhatsApp webhook (has from), send the message to user
    const waFrom = parsedPayload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ??
      parsedPayload?.messages?.[0]?.from ??
      parsedPayload?.message?.from ??
      null;

    if (waFrom) {
      try {
        await sendText(waFrom, message);
        await logStructuredEvent("INSURANCE_CONTACTS_SENT", {
          service: serviceName,
          requestId,
          correlationId,
          to: waFrom,
          contactCount: contacts.length,
        });
      } catch (sendErr) {
        await logStructuredEvent("INSURANCE_CONTACTS_SEND_ERROR", {
          service: serviceName,
          requestId,
          correlationId,
          to: waFrom,
          error: sendErr instanceof Error ? sendErr.message : String(sendErr),
        }, "warn");
        return new Response(
          JSON.stringify({ success: false, error: "send_failed" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ success: true, sentTo: waFrom, contactCount: contacts.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fallback: return payload for upstream sender
    return new Response(
      JSON.stringify({ 
        success: true, 
        message,
        contactCount: contacts.length,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (err) {
    await logStructuredEvent("INSURANCE_ERROR", {
      service: serviceName,
      requestId,
      correlationId,
      error: err instanceof Error ? err.message : String(err),
    }, "error");

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
