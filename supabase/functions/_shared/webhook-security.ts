/**
 * Shared Webhook Security Utilities
 * Consolidates signature verification, rate limiting, and idempotency checks
 * Used by: wa-webhook-profile, wa-webhook-mobility, etc.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { verifyWebhookSignature } from "./webhook-utils.ts";
import { logStructuredEvent } from "./observability.ts";
import { rateLimitMiddleware } from "./rate-limit/index.ts";

export interface WebhookSecurityConfig {
  serviceName: string;
  maxBodySize: number;
  rateLimit: number;
  rateWindow: number;
  verifySignature?: boolean;
}

export interface WebhookSecurityResult {
  allowed: boolean;
  requestId: string;
  correlationId: string;
  rawBody: string;
  response?: Response;
}

/**
 * Comprehensive webhook security check
 * Combines rate limiting, body size validation, and signature verification
 */
export async function webhookSecurityCheck(
  req: Request,
  config: WebhookSecurityConfig
): Promise<WebhookSecurityResult> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;
  
  const logEvent = (event: string, details: Record<string, unknown> = {}, level: "info" | "warn" | "error" = "info") => {
    logStructuredEvent(event, {
      service: config.serviceName,
      requestId,
      correlationId,
      ...details,
    }, level);
  };
  
  // Step 1: Rate limiting
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: config.rateLimit,
    windowSeconds: config.rateWindow,
  });
  
  if (!rateLimitCheck.allowed) {
    logEvent("RATE_LIMIT_EXCEEDED", {
      limit: config.rateLimit,
      window: config.rateWindow,
    }, "warn");
    return {
      allowed: false,
      requestId,
      correlationId,
      rawBody: "",
      response: rateLimitCheck.response,
    };
  }
  
  // Step 2: Body size check
  const rawBody = await req.text();
  if (rawBody.length > config.maxBodySize) {
    logEvent("BODY_TOO_LARGE", {
      size: rawBody.length,
      limit: config.maxBodySize,
    }, "warn");
    return {
      allowed: false,
      requestId,
      correlationId,
      rawBody: "",
      response: new Response(JSON.stringify({ 
        error: "payload_too_large",
        message: `Request body exceeds ${config.maxBodySize} bytes`,
      }), {
        status: 413,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      }),
    };
  }
  
  // Step 3: Signature verification (if enabled)
  if (config.verifySignature !== false) {
    const signature = req.headers.get("x-hub-signature-256") 
      ?? req.headers.get("x-hub-signature");
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") 
      ?? Deno.env.get("WA_APP_SECRET");
    const runtimeEnv = (Deno.env.get("DENO_ENV") ?? "development").toLowerCase();
    
    if (!appSecret) {
      logEvent("NO_APP_SECRET", {}, "error");
      return {
        allowed: false,
        requestId,
        correlationId,
        rawBody: "",
        response: new Response(JSON.stringify({ 
          error: "server_misconfigured",
          message: "Webhook app secret not configured",
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
          },
        }),
      };
    }
    
    if (signature) {
      const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
      if (!isValid) {
        // Check bypass conditions
        const allowUnsigned = runtimeEnv !== "production" && runtimeEnv !== "prod" &&
          (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";
        const internalForward = req.headers.get("x-wa-internal-forward") === "true";
        const allowInternalForward = (Deno.env.get("WA_ALLOW_INTERNAL_FORWARD") ?? "false").toLowerCase() === "true";
        const bypass = allowUnsigned || (internalForward && allowInternalForward);
        
        if (!bypass) {
          logEvent("SIGNATURE_FAILED", {
            signatureHeader: req.headers.has("x-hub-signature-256") ? "x-hub-signature-256" : "x-hub-signature",
            userAgent: req.headers.get("user-agent"),
          }, "error");
          return {
            allowed: false,
            requestId,
            correlationId,
            rawBody: "",
            response: new Response(JSON.stringify({ 
              error: "unauthorized",
              message: "Invalid webhook signature",
            }), {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                "X-Request-ID": requestId,
              },
            }),
          };
        }
        
        // Log bypass (should be rare in production)
        const level = (runtimeEnv === "production" || runtimeEnv === "prod") ? "error" : "info";
        logEvent("SIGNATURE_BYPASS", {
          reason: internalForward ? "internal_forward" : "signature_mismatch",
          environment: runtimeEnv,
          allowUnsigned,
          allowInternalForward,
        }, level);
      }
    } else if (runtimeEnv === "production" || runtimeEnv === "prod") {
      // No signature in production - reject
      logEvent("NO_SIGNATURE_PRODUCTION", {}, "error");
      return {
        allowed: false,
        requestId,
        correlationId,
        rawBody: "",
        response: new Response(JSON.stringify({ 
          error: "unauthorized",
          message: "Webhook signature required",
        }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
          },
        }),
      };
    }
  }
  
  logStructuredEvent("SECURITY_CHECK_PASSED", {
    service: config.serviceName,
    requestId,
    correlationId,
  }, "info");
  
  return {
    allowed: true,
    requestId,
    correlationId,
    rawBody,
  };
}

/**
 * Idempotency check for webhook messages
 * Prevents processing duplicate messages within a time window
 */
export async function checkIdempotency(
  supabase: SupabaseClient,
  messageId: string,
  phoneNumber: string,
  webhookType: string,
  windowMinutes: number = 5
): Promise<{ isDuplicate: boolean; shouldContinue: boolean }> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  
  const { data: processed } = await supabase
    .from("processed_webhooks")
    .select("id")
    .eq("message_id", messageId)
    .eq("webhook_type", webhookType)
    .gte("created_at", windowStart)
    .maybeSingle();
  
  if (processed) {
    logStructuredEvent(`${webhookType.toUpperCase()}_DUPLICATE_MESSAGE`, {
      messageId,
      masked_phone: phoneNumber.slice(-4),
    }, "info");
    return { isDuplicate: true, shouldContinue: false };
  }
  
  // Fire-and-forget insert
  supabase
    .from("processed_webhooks")
    .insert({
      message_id: messageId,
      phone_number: phoneNumber,
      webhook_type: webhookType,
      created_at: new Date().toISOString(),
    })
    .then(
      () => {},
      (error: Error) => {
        logStructuredEvent(`${webhookType.toUpperCase()}_IDEMPOTENCY_INSERT_FAILED`, {
          error: error.message,
        }, "warn");
      }
    );
  
  return { isDuplicate: false, shouldContinue: true };
}

/**
 * Standardized respond helper for webhooks
 */
export function createResponder(serviceName: string, requestId: string, correlationId: string) {
  return (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", serviceName);
    return new Response(JSON.stringify(body), { ...init, headers });
  };
}
