import { serve } from "./deps.ts";
import { supabase } from "./config.ts";
import { processWebhookRequest } from "./router/pipeline.ts";
import { handlePreparedWebhook } from "./router/processor.ts";
import { 
  handleHealthCheck, 
  handleMetricsRequest, 
  handleMetricsSummaryRequest,
  handlePrometheusMetrics 
} from "./shared/health_metrics.ts";

serve(async (req: Request): Promise<Response> => {
  const cid = crypto.randomUUID();
  const url = new URL(req.url);
  
  // Health check endpoint
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    return await handleHealthCheck(supabase);
  }
  
  // Metrics endpoints
  if (url.pathname === "/metrics" || url.pathname.endsWith("/metrics")) {
    // Prometheus format if requested
    if (req.headers.get("accept")?.includes("text/plain")) {
      return handlePrometheusMetrics();
    }
    return handleMetricsRequest();
  }
  
  if (url.pathname === "/metrics/summary" || url.pathname.endsWith("/metrics/summary")) {
    return handleMetricsSummaryRequest();
  }
  
  // Main webhook processing
  try {
    const result = await processWebhookRequest(req);

    if (result.type === "response") {
      return result.response;
    }

    return await handlePreparedWebhook(supabase, result);
  } catch (err) {
    // Prevent webhook retry storms; log correlation id for traceability
    console.error("wa_webhook.unhandled", { cid, error: String(err) });
    return new Response("ok", { status: 200 });
  }
});
// Updated Fri Nov 14 12:59:49 CET 2025
