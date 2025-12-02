/**
 * Service Forwarder
 * Forwards requests to appropriate microservices
 */

import type { RouterContext, WebhookPayload, HandlerResult } from "../../_shared/types/index.ts";
import { getEnv, SERVICES, TIMEOUTS } from "../../_shared/config/index.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

// ============================================================================
// FORWARDER
// ============================================================================

/**
 * Forward webhook payload to target service
 */
export async function forwardToService(
  ctx: RouterContext,
  targetService: string,
  payload: WebhookPayload
): Promise<HandlerResult> {
  const env = getEnv();
  const targetUrl = `${env.supabaseUrl}/functions/v1/${targetService}`;

  logStructuredEvent("FORWARD_START", {
    requestId: ctx.requestId,
    from: SERVICES.CORE,
    to: targetService,
  }, "debug");

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.ROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.supabaseServiceRoleKey}`,
        "X-Request-ID": ctx.requestId,
        "X-Correlation-ID": ctx.correlationId,
        "X-WA-Internal-Forward": "true",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = performance.now() - startTime;

    if (!response.ok) {
      logStructuredEvent("FORWARD_ERROR", {
        requestId: ctx.requestId,
        targetService,
        status: response.status,
        duration,
      }, "error");

      return { handled: false, error: new Error(`Forward failed: ${response.status}`) };
    }

    logStructuredEvent("FORWARD_SUCCESS", {
      requestId: ctx.requestId,
      targetService,
      status: response.status,
      duration,
    }, "debug");

    return { handled: true };

  } catch (error) {
    clearTimeout(timeoutId);
    const duration = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logStructuredEvent("FORWARD_EXCEPTION", {
      requestId: ctx.requestId,
      targetService,
      error: errorMessage,
      duration,
    }, "error");

    return { handled: false, error: error instanceof Error ? error : new Error(errorMessage) };
  }
}

/**
 * Forward to service by name (convenience function)
 */
export async function forward(
  ctx: RouterContext,
  serviceName: string,
  payload: unknown
): Promise<HandlerResult> {
  return forwardToService(ctx, serviceName, payload as WebhookPayload);
}
