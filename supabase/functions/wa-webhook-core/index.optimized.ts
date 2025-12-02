/**
 * wa-webhook-core - Optimized Entry Point
 * Performance-optimized version with caching and lazy loading
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Shared modules - imported at top level for bundling
import { getEnv, SERVICES } from "../_shared/config/index.ts";
import { getPooledClient } from "../_shared/database/client-pool.ts";
import { createSecurityMiddleware } from "../_shared/security/index.ts";
import { verifyWebhookRequest } from "../_shared/security/signature.ts";
import { logStructuredEvent } from "../_shared/observability/index.ts";
import { createErrorHandler } from "../_shared/errors/index.ts";
import { performHealthCheck, healthResponse } from "../_shared/health-check.ts";
import { trackColdStart, performanceMiddleware, trackHandler } from "../_shared/observability/performance-middleware.ts";
import { cacheMiddleware } from "../_shared/cache/index.ts";
import { deduplicationMiddleware, checkDuplicate } from "../_shared/middleware/deduplication.ts";
import { backgroundWarmup, isWarmedUp } from "../_shared/warmup/index.ts";
import { handlePerformanceRequest, getHealthMetrics } from "../_shared/observability/performance-endpoint.ts";
import type { WebhookPayload, RouterContext } from "../_shared/types/index.ts";

// ============================================================================
// INITIALIZATION
// ============================================================================

const SERVICE_NAME = SERVICES.CORE;
const SERVICE_VERSION = "2.3.0";

// Track cold start
trackColdStart(SERVICE_NAME);

// Initialize components lazily
let security: ReturnType<typeof createSecurityMiddleware> | null = null;
let errorHandler: ReturnType<typeof createErrorHandler> | null = null;

function getSecurityMiddleware() {
  if (!security) {
    security = createSecurityMiddleware(SERVICE_NAME);
  }
  return security;
}

function getErrorHandler() {
  if (!errorHandler) {
    errorHandler = createErrorHandler(SERVICE_NAME);
  }
  return errorHandler;
}

// Trigger background warmup after first request
let warmupTriggered = false;

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
  const startTime = performance.now();

  // Trigger background warmup on first request
  if (!warmupTriggered) {
    warmupTriggered = true;
    backgroundWarmup({
      preloadDatabase: true,
      preloadConfig: true,
      preloadHandlerNames: ["core:router", "core:home"],
    });
  }

  // Helper for responses
  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", SERVICE_NAME);
    headers.set("X-Response-Time", `${(performance.now() - startTime).toFixed(2)}ms`);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // -------------------------------------------------------------------------
  // Performance Endpoint
  // -------------------------------------------------------------------------
  if (url.pathname === "/metrics" || url.pathname.endsWith("/metrics")) {
    return handlePerformanceRequest(req);
  }

  // -------------------------------------------------------------------------
  // Health Check (with caching)
  // -------------------------------------------------------------------------
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    return await trackHandler("health_check", async () => {
      const supabase = getPooledClient();
      const healthMetrics = getHealthMetrics();
      
      const result = await performHealthCheck(SERVICE_NAME, SERVICE_VERSION, supabase, {
        checkDependencies: [SERVICES.PROFILE, SERVICES.MOBILITY, SERVICES.INSURANCE],
      });
      
      // Add performance metrics to health response
      return healthResponse({
        ...result,
        performance: healthMetrics.metrics,
        warmedUp: isWarmedUp(),
      });
    });
  }

  // -------------------------------------------------------------------------
  // Webhook Verification (GET)
  // -------------------------------------------------------------------------
  if (req.method === "GET") {
    return await trackHandler("webhook_verification", async () => {
      const env = getEnv();
      const hubMode = url.searchParams.get("hub.mode");
      const hubToken = url.searchParams.get("hub.verify_token");
      const hubChallenge = url.searchParams.get("hub.challenge");

      if (hubMode === "subscribe" && hubToken === env.waVerifyToken) {
        logStructuredEvent("WEBHOOK_VERIFIED", { requestId });
        return new Response(hubChallenge, { status: 200 });
      }

      return respond({ error: "verification_failed" }, { status: 403 });
    });
  }

  // -------------------------------------------------------------------------
  // Security Middleware
  // -------------------------------------------------------------------------
  const securityCheck = await getSecurityMiddleware().check(req);
  if (!securityCheck.passed) {
    return securityCheck.response!;
  }

  // -------------------------------------------------------------------------
  // Webhook Processing (POST)
  // -------------------------------------------------------------------------
  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  return await trackHandler("webhook_processing", async () => {
    try {
      const rawBody = await req.text();

      // Quick deduplication check
      const payload = JSON.parse(rawBody) as WebhookPayload;
      const messageId = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
      
      if (messageId) {
        const dedupResult = checkDuplicate(messageId);
        if (dedupResult.isDuplicate) {
          return respond({ success: true, duplicate: true });
        }
      }

      // Signature verification
      const signatureResult = await verifyWebhookRequest(req, rawBody, SERVICE_NAME);
      if (!signatureResult.valid) {
        logStructuredEvent("AUTH_FAILED", { requestId, reason: signatureResult.reason }, "warn");
        return respond({ error: "unauthorized" }, { status: 401 });
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

      // Build context with pooled client
      const ctx = await buildContext(message, requestId, correlationId);

      // Import and execute router (lazy loaded after first request)
      const { routeMessage } = await import("./router/index.ts");
      const routingResult = await routeMessage(ctx, message, payload);

      if (routingResult.handled) {
        return respond({ success: true, handled: true });
      }

      // Fallback: Show home menu
      const { handleHomeMenu } = await import("./handlers/home.ts");
      await handleHomeMenu(ctx);
      return respond({ success: true, handled: true, fallback: true });

    } catch (error) {
      return await getErrorHandler().handleError(error, {
        requestId,
        correlationId,
        operation: "webhook_processing",
      });
    }
  }, { service: SERVICE_NAME });
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
  const supabase = getPooledClient();
  
  // Use cached profile lookup
  const { getCachedProfileByPhone } = await import("../_shared/cache/cached-accessors.ts");
  const profile = await getCachedProfileByPhone(supabase, from);

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
