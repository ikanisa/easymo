/**
 * Example: Integrating Enhanced Processor into wa-webhook
 * 
 * This example shows how to integrate the enhanced processor into
 * the existing wa-webhook handler.
 * 
 * USAGE:
 * 1. Import this in your index.ts
 * 2. Set WA_ENHANCED_PROCESSING=true in environment
 * 3. Monitor with health checks
 */

import { serve } from "./deps.ts";
import { supabase } from "./config.ts";
import { processWebhookRequest } from "./router/pipeline.ts";
import { handlePreparedWebhook } from "./router/processor.ts";
import { 
  handlePreparedWebhookEnhanced,
  isEnhancedProcessingEnabled 
} from "./router/enhanced_processor.ts";
import {
  handleHealthCheck,
  handleMetricsRequest,
  handleMetricsSummaryRequest,
  handlePrometheusMetrics
} from "./shared/health_metrics.ts";
import { incrementMetric } from "./utils/metrics_collector.ts";

serve(async (req: Request): Promise<Response> => {
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
      enhanced: isEnhancedProcessingEnabled() ? "true" : "false",
      ...extraDimensions,
    });
    console.log(JSON.stringify({
      event: "WEBHOOK_HTTP_RESPONSE",
      correlationId,
      path: url.pathname,
      status: response.status,
      enhanced: isEnhancedProcessingEnabled(),
    }));
    return wrapped;
  };

  console.log(JSON.stringify({
    event: "WEBHOOK_HANDLER_ENTRY",
    correlationId,
    method: req.method,
    path: url.pathname,
    enhanced: isEnhancedProcessingEnabled(),
  }));

  // Health check endpoint
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    const response = await handleHealthCheck(supabase);
    return finalize(response, { scope: "health" });
  }

  // Metrics endpoints
  if (url.pathname === "/metrics" || url.pathname.endsWith("/metrics")) {
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

    // ENHANCEMENT INTEGRATION POINT
    // Choose between original and enhanced processor based on feature flag
    const response = isEnhancedProcessingEnabled()
      ? await handlePreparedWebhookEnhanced(supabase, result, handlePreparedWebhook)
      : await handlePreparedWebhook(supabase, result);

    return finalize(response);
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      event: "WEBHOOK_UNHANDLED_ERROR",
      correlationId,
      path: url.pathname,
      error: errorMessage,
      enhanced: isEnhancedProcessingEnabled(),
    }));
    return finalize(new Response("internal_error", { status: 500 }), {
      reason: "unhandled",
    });
  }
});

/**
 * ALTERNATIVE: Gradual Rollout by User
 * 
 * You can enable enhanced processing for specific users first:
 */
/*
function shouldUseEnhancedProcessing(userId: string): boolean {
  // Enable for test users
  const testUsers = ['test123', 'beta456'];
  if (testUsers.includes(userId)) return true;
  
  // Enable for percentage of users
  const rolloutPercentage = 10; // 10% of users
  const hash = hashCode(userId);
  return (hash % 100) < rolloutPercentage;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
*/
