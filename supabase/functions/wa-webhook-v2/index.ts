import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { 
  verifyWebhookSignature, 
  validateWebhookPayload,
  WebhookProcessor,
  RateLimiter,
  Logger,
  Metrics,
  CircuitBreaker
} from "../_shared/webhook-utils.ts";
import { WebhookError } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

// Initialize services
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const logger = new Logger({
  service: "wa-webhook-v2",
  environment: Deno.env.get("ENVIRONMENT") || "development"
});

const metrics = new Metrics(supabase);
const rateLimiter = new RateLimiter(supabase);
const circuitBreaker = new CircuitBreaker({
  threshold: 5,
  timeout: 30000,
  resetTimeout: 60000
});

serve(async (req) => {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();
  const method = req.method;
  
  // Set up context for logging
  logger.setContext({ correlationId, method });

  try {
    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // WhatsApp verification challenge
    if (method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === Deno.env.get("WEBHOOK_VERIFY_TOKEN")) {
        logger.info("Webhook verified successfully");
        return new Response(challenge, { status: 200 });
      }

      logger.warn("Invalid verification attempt", { mode, token });
      return new Response("Forbidden", { status: 403 });
    }

    // Handle webhook POST
    if (method === "POST") {
      const clientIp = req.headers.get("x-forwarded-for") || "unknown";
      
      // Rate limiting
      const rateLimitResult = await rateLimiter.checkLimit(clientIp, "webhook");
      if (!rateLimitResult.allowed) {
        logger.warn("Rate limit exceeded", { clientIp, ...rateLimitResult });
        await metrics.record("webhook.rate_limited", 1, { ip: clientIp });
        
        return new Response("Too Many Requests", {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": "60",
            "X-RateLimit-Limit": String(rateLimitResult.max_tokens),
            "X-RateLimit-Remaining": String(rateLimitResult.tokens_remaining || 0),
            "X-RateLimit-Reset": new Date(Date.now() + 60000).toISOString()
          }
        });
      }

      // Get raw body for signature verification
      const body = await req.text();
      const signature = req.headers.get("x-hub-signature-256");

      // Verify webhook signature
      const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;
      if (!verifyWebhookSignature(body, signature, webhookSecret)) {
        logger.error("Invalid webhook signature", { signature: signature?.substring(0, 10) });
        await metrics.record("webhook.signature_failed", 1);
        
        return new Response("Unauthorized", { 
          status: 401,
          headers: corsHeaders 
        });
      }

      // Parse and validate payload
      let payload;
      try {
        payload = JSON.parse(body);
        payload = validateWebhookPayload(payload);
      } catch (error) {
        logger.error("Invalid payload", { error: error.message });
        await metrics.record("webhook.validation_failed", 1);
        
        return new Response("Bad Request", { 
          status: 400,
          headers: corsHeaders 
        });
      }

      // Check idempotency for webhook events
      const webhookId = payload.entry?.[0]?.id;
      if (webhookId) {
        const idempotencyKey = `webhook:${webhookId}`;
        const { data: existing } = await supabase
          .from("idempotency_keys")
          .select("response, status_code")
          .eq("key", idempotencyKey)
          .single();

        if (existing) {
          logger.info("Duplicate webhook detected", { webhookId });
          await metrics.record("webhook.duplicate", 1);
          
          return new Response(existing.response.message || "OK", {
            status: existing.status_code,
            headers: {
              ...corsHeaders,
              "X-Idempotent-Replay": "true"
            }
          });
        }

        // Store idempotency key
        await supabase
          .from("idempotency_keys")
          .insert({
            key: idempotencyKey,
            response: { message: "OK" },
            status_code: 200
          });
      }

      // Queue webhook for processing
      const processor = new WebhookProcessor(supabase, logger, metrics);
      
      await circuitBreaker.fire(async () => {
        await processor.queueWebhook({
          payload,
          correlationId,
          priority: determinePriority(payload),
          source: "whatsapp"
        });
      });

      // Record metrics
      const processingTime = Date.now() - startTime;
      await metrics.record("webhook.processing_time", processingTime, {
        status: "success"
      });
      await metrics.record("webhook.received", 1, {
        type: getWebhookType(payload)
      });

      logger.info("Webhook queued successfully", {
        processingTime,
        webhookId
      });

      // Return success immediately
      return new Response("OK", {
        status: 200,
        headers: {
          ...corsHeaders,
          "X-Correlation-Id": correlationId,
          "X-Process-Time": `${processingTime}ms`
        }
      });
    }

    // Method not allowed
    return new Response("Method Not Allowed", { 
      status: 405,
      headers: corsHeaders 
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error("Webhook processing error", {
      error: error.message,
      stack: error.stack,
      processingTime
    });

    await metrics.record("webhook.error", 1, {
      error: error.name || "unknown"
    });

    // Return appropriate error response
    if (error instanceof WebhookError) {
      return new Response(error.message, {
        status: error.statusCode,
        headers: {
          ...corsHeaders,
          "X-Error-Code": error.code
        }
      });
    }

    return new Response("Internal Server Error", {
      status: 500,
      headers: {
        ...corsHeaders,
        "X-Correlation-Id": correlationId
      }
    });
  }
});

// Helper functions
function determinePriority(payload: any): number {
  // Higher priority for customer messages
  if (payload.entry?.[0]?.changes?.[0]?.value?.messages) {
    return 8;
  }
  // Medium priority for status updates
  if (payload.entry?.[0]?.changes?.[0]?.value?.statuses) {
    return 5;
  }
  // Low priority for other events
  return 3;
}

function getWebhookType(payload: any): string {
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  if (value?.messages) return "message";
  if (value?.statuses) return "status";
  if (value?.errors) return "error";
  return "unknown";
}
