/**
 * Enhanced Middleware Integration for wa-webhook
 *
 * Provides middleware functions that integrate rate limiting, caching,
 * error handling, and metrics without modifying existing code.
 *
 * These can be optionally integrated into the existing pipeline.
 *
 * @see docs/GROUND_RULES.md
 */

import type { PreparedResponse, PreparedWebhook } from "../router/pipeline.ts";
import { checkRateLimit } from "./rate_limiter.ts";
import { getCached, getOrSetCached, setCached } from "./cache.ts";
import {
  ErrorCode,
  handleWebhookError,
  WebhookError,
} from "./error_handler.ts";
import { incrementMetric, recordMetricHistogram } from "./metrics_collector.ts";
import { loadConfig } from "./config_validator.ts";

const config = loadConfig();

/**
 * Apply rate limiting middleware
 *
 * Can be called from existing pipeline to add rate limiting
 */
export function applyRateLimiting(
  phoneNumber: string,
  correlationId: string,
): { allowed: boolean; response?: Response } {
  if (!config.enableRateLimiting) {
    return { allowed: true };
  }

  const result = checkRateLimit(phoneNumber, correlationId);

  if (!result.allowed) {
    incrementMetric("wa_webhook_rate_limited", 1, {
      phoneNumber: phoneNumber.slice(0, 4) + "***",
    });

    const response = new Response(
      JSON.stringify({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests",
          correlationId,
          retryAfter: result.retryAfter,
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-Correlation-ID": correlationId,
          "Retry-After": String(result.retryAfter || 60),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(result.resetTime),
        },
      },
    );

    return { allowed: false, response };
  }

  return { allowed: true };
}

/**
 * Track webhook metrics
 */
export function trackWebhookMetrics(
  prepared: PreparedWebhook,
  startTime: number,
): void {
  const duration = Date.now() - startTime;

  incrementMetric("wa_webhook_requests", 1, {
    messageCount: prepared.messages.length,
  });

  recordMetricHistogram("wa_webhook_duration_ms", duration, {
    messageCount: prepared.messages.length,
  });

  for (const msg of prepared.messages) {
    incrementMetric("wa_webhook_messages", 1, {
      type: msg.type || "unknown",
    });
  }
}

/**
 * Cache user context with automatic expiration
 *
 * Can be used in message_context.ts to cache user lookups
 */
export async function getCachedUserContext(
  phoneNumber: string,
  fetcher: () => Promise<any>,
): Promise<any> {
  if (!config.enableCaching) {
    return await fetcher();
  }

  const cacheKey = `user_context:${phoneNumber}`;
  return await getOrSetCached(cacheKey, fetcher, config.cacheDefaultTTL);
}

/**
 * Wrap error with enhanced error handling
 *
 * Can be used in existing try-catch blocks to enhance error responses
 */
export async function wrapError(
  error: any,
  context: {
    correlationId: string;
    phoneNumber?: string;
    userId?: string;
    operation?: string;
    duration?: number;
  },
): Promise<Response> {
  incrementMetric("wa_webhook_errors", 1, {
    operation: context.operation || "unknown",
  });

  return await handleWebhookError(
    error,
    context,
    config.enableUserErrorNotifications,
  );
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  phoneNumber: string,
  correlationId: string,
): Response {
  if (!config.enableRateLimiting) {
    return response;
  }

  const result = checkRateLimit(phoneNumber, correlationId);

  const headers = new Headers(response.headers);
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(result.resetTime));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Middleware function to enhance PreparedWebhook
 *
 * This can be called after processWebhookRequest to add enhancements
 */
export async function enhanceWebhookRequest(
  req: Request,
  prepared: PreparedWebhook | PreparedResponse,
  startTime: number,
): Promise<PreparedWebhook | PreparedResponse> {
  // If it's already a response, return it
  if (prepared.type === "response") {
    return prepared;
  }

  // Track metrics
  trackWebhookMetrics(prepared, startTime);

  // Apply rate limiting to each unique sender
  const uniqueSenders = new Set(prepared.messages.map((msg) => msg.from));
  const correlationId = crypto.randomUUID();

  for (const sender of uniqueSenders) {
    const rateLimitResult = applyRateLimiting(sender, correlationId);

    if (!rateLimitResult.allowed && rateLimitResult.response) {
      return {
        type: "response",
        response: rateLimitResult.response,
        correlationId,
      };
    }
  }

  return prepared;
}

/**
 * Log webhook processing completion
 */
export function logWebhookCompletion(
  prepared: PreparedWebhook,
  startTime: number,
  success: boolean,
): void {
  const duration = Date.now() - startTime;

  incrementMetric("wa_webhook_completed", 1, {
    success: String(success),
    messageCount: prepared.messages.length,
  });

  recordMetricHistogram("wa_webhook_total_duration_ms", duration, {
    success: String(success),
  });

  logStructuredEvent("WEBHOOK_COMPLETED", {
    duration,
    success,
    messageCount: prepared.messages.length,
  }, "info");
}

/**
 * Example: Enhanced message processor wrapper
 *
 * This shows how to wrap existing handleMessage calls with enhancements
 */
export async function processMessageWithEnhancements(
  ctx: any,
  msg: any,
  state: any,
  handleMessage: (ctx: any, msg: any, state: any) => Promise<void>,
): Promise<void> {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();

  try {
    // Apply rate limiting
    const rateLimitResult = applyRateLimiting(msg.from, correlationId);
    if (!rateLimitResult.allowed) {
      throw new WebhookError(
        "Rate limit exceeded",
        ErrorCode.RATE_LIMIT_ERROR,
        429,
        { retryAfter: 60 },
      );
    }

    // Track message processing start
    incrementMetric("wa_message_processing_started", 1, {
      type: msg.type || "unknown",
    });

    // Call original handler
    await handleMessage(ctx, msg, state);

    // Track success
    const duration = Date.now() - startTime;
    recordMetricHistogram("wa_message_processing_duration_ms", duration, {
      type: msg.type || "unknown",
      status: "success",
    });

    incrementMetric("wa_message_processing_completed", 1, {
      type: msg.type || "unknown",
      status: "success",
    });
  } catch (error) {
    // Track error
    const duration = Date.now() - startTime;
    recordMetricHistogram("wa_message_processing_duration_ms", duration, {
      type: msg.type || "unknown",
      status: "error",
    });

    incrementMetric("wa_message_processing_completed", 1, {
      type: msg.type || "unknown",
      status: "error",
    });

    throw error;
  }
}

/**
 * Utility to check if enhancements are enabled
 */
export function areEnhancementsEnabled(): boolean {
  return config.enableRateLimiting ||
    config.enableCaching ||
    config.enableUserErrorNotifications;
}

/**
 * Get enhancement configuration
 */
export function getEnhancementConfig() {
  return {
    rateLimiting: config.enableRateLimiting,
    caching: config.enableCaching,
    userErrorNotifications: config.enableUserErrorNotifications,
    environment: config.environment,
  };
}
