import { serve } from "./deps.ts";

/**
 * ⚠️ DEPRECATION NOTICE ⚠️
 * 
 * This function (wa-webhook) is DEPRECATED and should NOT be deployed.
 * 
 * This directory now serves as a SHARED CODE LIBRARY for WhatsApp webhook microservices.
 * The actual webhook routing is handled by wa-webhook-core.
 * 
 * Deployed microservices that use this shared code:
 * - wa-webhook-core (ingress/router)
 * - wa-webhook-ai-agents
 * - wa-webhook-mobility
 * - wa-webhook-wallet
 * - wa-webhook-jobs
 * - wa-webhook-property
 * - wa-webhook-marketplace
 * - wa-webhook-insurance
 * 
 * If you need to make changes, edit files here but deploy the microservices above.
 * 
 * To deploy all WhatsApp functions: pnpm run functions:deploy:wa
 * 
 * DO NOT USE: supabase functions deploy wa-webhook
 * USE INSTEAD: supabase functions deploy wa-webhook-core (and other microservices)
 */

// Wrap config import in try-catch to catch initialization errors
let supabase: any;
let configError: Error | null = null;

try {
  const configModule = await import("./config.ts");
  // Fail fast if required runtime envs are missing
  try {
    if (typeof configModule.assertRuntimeReady === "function") {
      configModule.assertRuntimeReady();
    }
  } catch (e) {
    configError = e instanceof Error ? e : new Error(String(e));
  }
  supabase = configModule.supabase;
} catch (err) {
  configError = err instanceof Error ? err : new Error(String(err));
  console.error(JSON.stringify({
    event: "CONFIG_INITIALIZATION_ERROR",
    error: configError.message,
    errorType: configError.constructor.name,
    errorStack: configError.stack,
  }));
}

import { processWebhookRequest } from "./router/pipeline.ts";
import { handlePreparedWebhook } from "./router/processor.ts";
import {
  handleHealthCheck,
  handleMetricsRequest,
  handleMetricsSummaryRequest,
  handlePrometheusMetrics
} from "./shared/health_metrics.ts";
import { incrementMetric } from "./utils/metrics_collector.ts";
import { handlePreparedWebhookEnhanced } from "./router/enhanced_processor.ts";

serve(async (req: Request): Promise<Response> => {
  // Check for config initialization error first
  if (configError) {
    console.error(JSON.stringify({
      event: "CONFIG_ERROR_ON_REQUEST",
      error: configError.message,
      path: new URL(req.url).pathname,
    }));
    return new Response(JSON.stringify({
      error: "configuration_error",
      message: configError.message,
      details: "Missing required environment variables. Check Supabase secrets."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = new URL(req.url);
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const instrumentedRequest = new Request(req, {
    headers: new Headers(req.headers),
  });
  instrumentedRequest.headers.set("x-correlation-id", correlationId);

  const finalize = (
    response: Response,
    extraDimensions: Record<string, string | number> = {},
  ): Response => {
    const headers = new Headers(response.headers);
    headers.set("X-Correlation-ID", correlationId);
    const wrapped = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    const metricName = response.status >= 400
      ? "wa_webhook_http_failure_total"
      : "wa_webhook_http_success_total";
    incrementMetric(metricName, 1, {
      status: response.status,
      path: url.pathname,
      ...extraDimensions,
    });
    console.log(JSON.stringify({
      event: "WEBHOOK_HTTP_RESPONSE",
      correlationId,
      path: url.pathname,
      status: response.status,
    }));
    return wrapped;
  };

  console.log(JSON.stringify({
    event: "WEBHOOK_HANDLER_ENTRY",
    correlationId,
    method: req.method,
    path: url.pathname,
  }));

  // Health check endpoint
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    const response = await handleHealthCheck(supabase);
    return finalize(response, { scope: "health" });
  }

  // Metrics endpoints
  if (url.pathname === "/metrics" || url.pathname.endsWith("/metrics")) {
    // Prometheus format if requested
    if (req.headers.get("accept")?.includes("text/plain")) {
      return finalize(handlePrometheusMetrics(), { scope: "metrics" });
    }
    return finalize(await handleMetricsRequest(), { scope: "metrics" });
  }

  if (url.pathname === "/metrics/summary" || url.pathname.endsWith("/metrics/summary")) {
    return finalize(await handleMetricsSummaryRequest(), { scope: "metrics" });
  }

  // Main webhook processing
  try {
    const result = await processWebhookRequest(instrumentedRequest);

    if (result.type === "response") {
      return finalize(result.response);
    }

    return finalize(await handlePreparedWebhookEnhanced(supabase, result, handlePreparedWebhook));
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    const errorObj = err && typeof err === 'object' ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : String(err);
    
    console.error(JSON.stringify({
      event: "WEBHOOK_UNHANDLED_ERROR",
      correlationId,
      path: url.pathname,
      error: errorMessage,
      errorType: err?.constructor?.name,
      errorStack,
      errorObject: errorObj,
    }));
    return finalize(new Response("internal_error", { status: 500 }), {
      reason: "unhandled",
    });
  }
});
// Updated Fri Nov 14 12:59:49 CET 2025
