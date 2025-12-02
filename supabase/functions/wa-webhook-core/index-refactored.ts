/**
 * wa-webhook-core - Central Router Service
 * Entry point for all WhatsApp webhook messages
 * 
 * @version 2.3.0
 * @description Routes incoming messages to appropriate microservices
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared modules
import { getEnv, validateEnv, SERVICES } from "../_shared/config/index.ts";
import { createSecurityMiddleware } from "../_shared/security/middleware.ts";
import { verifyWebhookRequest } from "../_shared/security/signature.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { createErrorHandler } from "../_shared/errors/error-handler.ts";
import type { WebhookPayload, RouterContext } from "../_shared/types/index.ts";
import { ensureProfile } from "../_shared/state/index.ts";

// Local modules
import { routeMessage } from "./router/index.ts";
import { handleWebhookVerification } from "./handlers/webhook.ts";
import { handleHomeMenu } from "./handlers/home.ts";
import { performHealthCheck, healthResponse } from "./handlers/health.ts";

// ============================================================================
// INITIALIZATION
// ============================================================================

const SERVICE_NAME = SERVICES.CORE;
const SERVICE_VERSION = "2.3.0";

// Validate environment on cold start
validateEnv();

const env = getEnv();
const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
const security = createSecurityMiddleware(SERVICE_NAME);
const errorHandler = createErrorHandler(SERVICE_NAME);

logStructuredEvent("SERVICE_STARTED", { 
  service: SERVICE_NAME, 
  version: SERVICE_VERSION 
});

// ============================================================================
// REQUEST HANDLER
// ============================================================================

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  // Helper for responses
  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", SERVICE_NAME);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // -------------------------------------------------------------------------
  // Health Check
  // -------------------------------------------------------------------------
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    const result = await performHealthCheck();
    return healthResponse(result);
  }

  // -------------------------------------------------------------------------
  // Webhook Verification (GET)
  // -------------------------------------------------------------------------
  if (req.method === "GET") {
    return handleWebhookVerification(req, respond);
  }

  // -------------------------------------------------------------------------
  // Security Middleware
  // -------------------------------------------------------------------------
  const securityCheck = await security.check(req);
  if (!securityCheck.passed) {
    return securityCheck.response!;
  }

  // -------------------------------------------------------------------------
  // Webhook Processing (POST)
  // -------------------------------------------------------------------------
  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  try {
    const rawBody = await req.text();

    // Signature verification
    const signatureResult = await verifyWebhookRequest(req, rawBody, SERVICE_NAME);
    if (!signatureResult.valid) {
      logStructuredEvent("AUTH_FAILED", { 
        requestId, 
        reason: signatureResult.reason 
      }, "warn");
      return respond({ error: "unauthorized" }, { status: 401 });
    }

    // Parse payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return respond({ error: "invalid_payload" }, { status: 400 });
    }

    logStructuredEvent("WEBHOOK_RECEIVED", {
      requestId,
      entryCount: payload.entry?.length ?? 0,
    });

    // Extract first message
    const message = extractFirstMessage(payload);
    if (!message) {
      return respond({ success: true, message: "No message to process" });
    }

    // Build context
    const ctx = await buildContext(message, requestId, correlationId);

    // Route message
    const routingResult = await routeMessage(ctx, message, payload);

    if (routingResult.handled) {
      return respond({ success: true, handled: true });
    }

    // Fallback: Show home menu
    await handleHomeMenu(ctx);
    return respond({ success: true, handled: true, fallback: true });

  } catch (error) {
    return await errorHandler.handleError(error, {
      requestId,
      correlationId,
      operation: "webhook_processing",
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractFirstMessage(payload: WebhookPayload): Record<string, unknown> | null {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages;
      if (messages?.length) {
        return messages[0] as Record<string, unknown>;
      }
    }
  }
  return null;
}

async function buildContext(
  message: Record<string, unknown>,
  requestId: string,
  correlationId: string
): Promise<RouterContext> {
  const from = String(message.from ?? "");
  
  // Ensure profile exists
  const profile = await ensureProfile(supabase, from);

  return {
    supabase,
    from,
    profileId: profile?.user_id,
    locale: (profile?.language || "en") as any,
    requestId,
    correlationId,
    service: SERVICES.CORE,
    timestamp: new Date(),
  };
}
