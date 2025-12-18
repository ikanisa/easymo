/// <reference types="https://deno.land/x/types/index.d.ts" />
/// <reference lib="deno.ns" />

// Allow Node-based unit tests to import this module without the Deno global.
// deno-lint-ignore no-explicit-any
declare const Deno: { env?: { get(key: string): string | undefined } } | undefined;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/wa-webhook-shared/config.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import {
  forwardToEdgeService,
  routeIncomingPayload,
  summarizeServiceHealth,
} from "./router.ts";
import { LatencyTracker } from "./telemetry.ts";
import {
  checkRateLimit,
  cleanupRateLimitState,
} from "../_shared/service-resilience.ts";
import { maskPhone } from "../_shared/phone-utils.ts";
import { logError } from "../_shared/correlation-logging.ts";
import { storeDLQEntry } from "../_shared/dlq-manager.ts";
import { checkRequiredEnv, REQUIRED_CORE_VARS } from "../_shared/env-check.ts";
// Phase 2: Enhanced security modules
import { createSecurityMiddleware } from "../_shared/security/middleware.ts";
import { verifyWebhookRequest } from "../_shared/security/signature.ts";
import { createAuditLogger } from "../_shared/security/audit-logger.ts";
import { createErrorHandler } from "../_shared/errors/error-handler.ts";
import { extractPhoneFromPayload } from "./utils/payload.ts";
// Note: extractPhoneFromPayload is imported from utils/payload.ts, not defined locally

const coldStartMarker = performance.now();

// Phase 2: Initialize security infrastructure
const securityMiddleware = createSecurityMiddleware("wa-webhook-core", {
  maxBodySize: 1024 * 1024, // 1MB
  rateLimit: {
    enabled: true,
    limit: 100,
    windowSeconds: 60,
  },
});
const auditLogger = createAuditLogger("wa-webhook-core", supabase);
const errorHandler = createErrorHandler("wa-webhook-core");

// Constants
const LATENCY_WINDOW_SIZE = 120;
const DEFAULT_COLD_START_SLO_MS = 1750;
const DEFAULT_P95_SLO_MS = 1200;
const CLEANUP_INTERVAL = 100; // Cleanup every N requests

const getEnvValue = (key: string): string | undefined => {
  return typeof Deno !== "undefined" && Deno?.env?.get ? Deno.env.get(key) : undefined;
};

const latencyTracker = new LatencyTracker({
  windowSize: LATENCY_WINDOW_SIZE,
  coldStartSloMs: Number(getEnvValue("WA_CORE_COLD_START_SLO_MS") ?? String(DEFAULT_COLD_START_SLO_MS)) ||
    DEFAULT_COLD_START_SLO_MS,
  p95SloMs: Number(getEnvValue("WA_CORE_P95_SLO_MS") ?? String(DEFAULT_P95_SLO_MS)) || DEFAULT_P95_SLO_MS,
});

// Request counter for deterministic cleanup scheduling
let requestCounter = 0;

serve(async (req: Request): Promise<Response> => {
  requestCounter++;
  const requestStart = performance.now();
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ??
    crypto.randomUUID();

  // record cold start once per instance
  latencyTracker.recordColdStart(coldStartMarker, requestStart, correlationId);

  const json = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  const finalize = (
    response: Response,
    routedService = "wa-webhook-core",
  ) => {
    const headers = new Headers(response.headers);
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Routed-Service", routedService);
    const durationMs = latencyTracker.recordLatency(
      performance.now() - requestStart,
      correlationId,
    );
    headers.set("X-WA-Core-Latency", `${Math.round(durationMs)}ms`);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };

  const log = (
    event: string,
    details: Record<string, unknown> = {},
    level: "debug" | "info" | "warn" | "error" = "info",
  ) => {
    logStructuredEvent(event, {
      service: "wa-webhook-core",
      requestId,
      path: url.pathname,
      ...details,
    }, level);
  };

  // Health endpoint (single, consistent implementation)
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    try {
      const serviceHealth = await summarizeServiceHealth(supabase);
      log("CORE_HEALTH", { status: serviceHealth.status });
      return finalize(
        new Response(JSON.stringify(serviceHealth, null, 2), {
          status: serviceHealth.status === "healthy" ? 200 : 503,
          headers: { "Content-Type": "application/json" },
        }),
        "wa-webhook-core",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log("CORE_HEALTH_ERROR", { error: message }, "error");
      return json({
        status: "unhealthy",
        service: "wa-webhook-core",
        error: message,
      }, { status: 503 });
    }
  }

  // Configuration check endpoint
  if (
    url.pathname === "/config-check" || url.pathname.endsWith("/config-check")
  ) {
    // Use the env-check utility to validate required vars
    const envCheck = checkRequiredEnv(REQUIRED_CORE_VARS);

    const configStatus = {
      service: "wa-webhook-core",
      timestamp: new Date().toISOString(),
      environment: {
        // Core Supabase
        SUPABASE_URL: !!getEnvValue("SUPABASE_URL"),
        SUPABASE_SERVICE_ROLE_KEY: !!getEnvValue("SUPABASE_SERVICE_ROLE_KEY"),

        // WhatsApp
        WA_PHONE_ID: !!getEnvValue("WA_PHONE_ID") ||
          !!getEnvValue("WHATSAPP_PHONE_NUMBER_ID"),
        WA_TOKEN: !!getEnvValue("WA_TOKEN") ||
          !!getEnvValue("WHATSAPP_ACCESS_TOKEN"),
        WA_APP_SECRET: !!getEnvValue("WA_APP_SECRET") ||
          !!getEnvValue("WHATSAPP_APP_SECRET"),
        WA_VERIFY_TOKEN: !!getEnvValue("WA_VERIFY_TOKEN") ||
          !!getEnvValue("WHATSAPP_VERIFY_TOKEN"),

        // AI Providers
        OPENAI_API_KEY: !!getEnvValue("OPENAI_API_KEY"),
        GEMINI_API_KEY: !!getEnvValue("GEMINI_API_KEY"),

        // Optional
        UPSTASH_REDIS_URL: !!getEnvValue("UPSTASH_REDIS_URL"),
        UPSTASH_REDIS_TOKEN: !!getEnvValue("UPSTASH_REDIS_TOKEN"),
      },
      missing: envCheck.missing,
      warnings: envCheck.warnings,
    };

    log("CORE_CONFIG_CHECK", {
      missing: configStatus.missing,
      warnings: configStatus.warnings,
    });
    return json(configStatus, {
      status: configStatus.missing.length > 0 ? 503 : 200,
    });
  }

  // WhatsApp verification handshake (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === getEnvValue("WA_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", {
        status: 200,
        headers: {
          "X-Request-ID": requestId,
          "X-Correlation-ID": correlationId,
        },
      });
    }
    return json({ error: "forbidden" }, { status: 403 });
  }

  // Webhook ingress (POST)
  let rawBody: string | null = null;
  try {
    // Phase 2: Run security middleware checks
    const securityCheck = await securityMiddleware.check(req);
    if (!securityCheck.passed) {
      return finalize(securityCheck.response!, "wa-webhook-core");
    }

    // Read raw body for signature verification (store for potential DLQ use)
    rawBody = await req.text();

    // Phase 2: Enhanced signature verification
    const signatureResult = await verifyWebhookRequest(
      req,
      rawBody,
      "wa-webhook-core",
    );

    if (!signatureResult.valid) {
      // Audit log failed authentication
      await auditLogger.logAuth(requestId, correlationId, "failure", {
        method: signatureResult.method ?? undefined,
        reason: signatureResult.reason,
        ipAddress: securityCheck.context.clientIp ?? undefined,
        userAgent: securityCheck.context.userAgent ?? undefined,
      });

      const error = errorHandler.createError("AUTH_INVALID_SIGNATURE");
      return finalize(
        errorHandler.createErrorResponse(error, requestId, correlationId),
        "wa-webhook-core",
      );
    }

    // Log successful authentication
    await auditLogger.logAuth(requestId, correlationId, "success", {
      method: signatureResult.method ?? undefined,
      ipAddress: securityCheck.context.clientIp ?? undefined,
    });

    // Parse payload after verification with error handling
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      log("CORE_JSON_PARSE_ERROR", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      }, "error");
      return json({
        error: "invalid_json",
        message: "Failed to parse request body as JSON",
      }, { status: 400 });
    }

    // Extract phone number for rate limiting
    const phoneNumber = extractPhoneFromPayload(payload);
    if (phoneNumber) {
      const rateCheck = checkRateLimit(phoneNumber);
      if (!rateCheck.allowed) {
        log("CORE_RATE_LIMITED", {
          phone: maskPhone(phoneNumber),
          resetAt: new Date(rateCheck.resetAt).toISOString(),
        }, "warn");
        return json({
          error: "rate_limit_exceeded",
          retryAfter: Math.ceil((rateCheck.resetAt - Date.now()) / 1000),
        }, {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((rateCheck.resetAt - Date.now()) / 1000),
            ),
          },
        });
      }
    }

    // Periodically cleanup rate limit state using deterministic counter
    if (requestCounter % CLEANUP_INTERVAL === 0) {
      cleanupRateLimitState();
    }

    log("CORE_WEBHOOK_RECEIVED", { payloadType: typeof payload });

    // Check for intent notification opt-out/opt-in FIRST (before any routing)
    const { handleIntentOptOut } = await import("./handlers/intent-opt-out.ts");
    const optOutHandled = await handleIntentOptOut(payload, supabase);
    if (optOutHandled) {
      log("INTENT_OPT_OUT_HANDLED", {});
      // Return success to Meta - handler already sent response to user
      return finalize(
        json({ success: true, handled: "opt_out" }, { status: 200 }),
        "wa-webhook-core",
      );
    }

    // Check if this is a call event BEFORE routing messages
    const calls = payload?.entry?.[0]?.changes?.[0]?.value?.calls;
    const callEvent = calls?.[0]; // Get first call from array
    if (callEvent) {
      log("CORE_CALL_EVENT_DETECTED", {
        callId: callEvent.id,
        event: callEvent.event,
        from: callEvent.from?.slice(-4),
      });

      // Forward directly to voice-calls handler
      const voiceCallsUrl = `${
        getEnvValue("SUPABASE_URL") ?? ""
      }/functions/v1/wa-webhook-voice-calls`;
      try {
        const forwardResponse = await fetch(voiceCallsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Correlation-ID": correlationId,
            "X-Request-ID": requestId,
            "Authorization": `Bearer ${
              getEnvValue("SUPABASE_SERVICE_ROLE_KEY") ?? ""
            }`,
          },
          body: JSON.stringify(payload),
        });

        log("CORE_CALL_FORWARDED", {
          callId: callEvent.id,
          status: forwardResponse.status,
        });

        return finalize(forwardResponse, "wa-webhook-voice-calls");
      } catch (forwardError) {
        log("CORE_CALL_FORWARD_ERROR", {
          callId: callEvent.id,
          error: forwardError instanceof Error
            ? forwardError.message
            : String(forwardError),
        }, "error");

        // Return success to Meta to prevent retries, but log the error
        return json({ success: true, error: "voice_call_forward_failed" }, {
          status: 200,
        });
      }
    }

    const decision = await routeIncomingPayload(payload);
    log("CORE_ROUTING_DECISION", {
      service: decision.service,
      reason: decision.reason,
      routingText: decision.routingText,
    });
    const forwarded = await forwardToEdgeService(
      decision,
      payload,
      req.headers,
    );
    return finalize(forwarded, decision.service);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("WA_WEBHOOK_CORE_ERROR", { correlationId, message }, {
      correlationId,
    });

    // Store failed message in DLQ for retry
    // Use rawBody from outer scope if available, otherwise try to clone request
    if (rawBody) {
      try {
        const payload = JSON.parse(rawBody);
        const phoneNumber = extractPhoneFromPayload(payload);

        if (phoneNumber) {
          await storeDLQEntry(supabase, {
            phone_number: phoneNumber,
            service: "wa-webhook-core",
            correlation_id: correlationId,
            request_id: requestId,
            payload: payload,
            error_message: message,
            error_type: err instanceof Error
              ? err.constructor.name
              : "UnknownError",
            status_code: 500,
            retry_count: 0,
          });

          log("CORE_MESSAGE_QUEUED_FOR_RETRY", {
            phone: maskPhone(phoneNumber),
          }, "info");
        }
      } catch (dlqError) {
        logError("CORE_DLQ_STORE_FAILED", {
          correlationId,
          dlqError: dlqError instanceof Error
            ? dlqError.message
            : String(dlqError),
        }, { correlationId });
      }
    } else {
      // If rawBody is not available, try to clone request as fallback
      try {
        const clonedBody = await req.clone().text();
        const payload = JSON.parse(clonedBody);
        const phoneNumber = extractPhoneFromPayload(payload);

        if (phoneNumber) {
          await storeDLQEntry(supabase, {
            phone_number: phoneNumber,
            service: "wa-webhook-core",
            correlation_id: correlationId,
            request_id: requestId,
            payload: payload,
            error_message: message,
            error_type: err instanceof Error
              ? err.constructor.name
              : "UnknownError",
            status_code: 500,
            retry_count: 0,
          });

          log("CORE_MESSAGE_QUEUED_FOR_RETRY", {
            phone: maskPhone(phoneNumber),
          }, "info");
        }
      } catch (dlqError) {
        logError("CORE_DLQ_STORE_FAILED", {
          correlationId,
          dlqError: dlqError instanceof Error
            ? dlqError.message
            : String(dlqError),
          note: "Could not read request body for DLQ storage",
        }, { correlationId });
      }
    }

    // Phase 2: Enhanced error handling
    return finalize(
      await errorHandler.handleError(err, {
        requestId,
        correlationId,
        operation: "webhook_processing",
      }),
      "wa-webhook-core",
    );
  }
});

// extractPhoneFromPayload is imported from utils/payload.ts
// maskPhone is imported from phone-utils.ts
