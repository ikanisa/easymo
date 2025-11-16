import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
import { forwardToEdgeService, routeIncomingPayload, summarizeServiceHealth } from "./router.ts";
import { LatencyTracker } from "./telemetry.ts";

const coldStartMarker = performance.now();
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const latencyTracker = new LatencyTracker({
  windowSize: 120,
  coldStartSloMs: Number(Deno.env.get("WA_CORE_COLD_START_SLO_MS") ?? "1750") || 1750,
  p95SloMs: Number(Deno.env.get("WA_CORE_P95_SLO_MS") ?? "1200") || 1200,
});

serve(async (req: Request): Promise<Response> => {
  const requestStart = performance.now();
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const respond = (
    body: unknown,
    init: ResponseInit = {},
  ): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  const logEvent = (
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
  
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    const startedAt = Date.now();
    try {
      // Check profiles table (core user table)
      const { error } = await supabase.from("profiles").select("user_id").limit(1);
      const healthy = !error;

      logEvent("CORE_HEALTH_CHECK", {
        healthy,
        durationMs: Date.now() - startedAt,
        error: error?.message,
      }, healthy ? "info" : "warn");

      return respond({
        status: healthy ? "healthy" : "unhealthy",
        service: "wa-webhook-core",
        timestamp: new Date().toISOString(),
        requestId,
        checks: {
          database: healthy ? "connected" : "disconnected",
          table: "profiles",
          duration_ms: Date.now() - startedAt,
        },
        version: "1.0.0",
        ...(error && { error: error.message }),
      }, { status: healthy ? 200 : 503 });
    } catch (err) {
      logEvent("CORE_HEALTH_CHECK_ERROR", {
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      }, "error");

      return respond({
        status: "unhealthy",
        service: "wa-webhook-core",
        requestId,
        error: err instanceof Error ? err.message : String(err),
        checks: { database: "error" },
      }, { status: 503 });
    }
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  latencyTracker.recordColdStart(coldStartMarker, requestStart, correlationId);

  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    const serviceHealth = await summarizeServiceHealth(supabase);
    return finalize(new Response(JSON.stringify(serviceHealth, null, 2), {
      status: serviceHealth.status === "healthy" ? 200 : 503,
      headers: { "Content-Type": "application/json" },
    }), correlationId, requestStart);
  }

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return respond(challenge, { status: 200 });
    }
    return respond({ error: "forbidden" }, { status: 403 });
      return finalize(new Response(challenge, { status: 200 }), correlationId, requestStart);
    }
    return finalize(new Response("Forbidden", { status: 403 }), correlationId, requestStart);
  }

  try {
    const payload = await req.json();
    logEvent("CORE_WEBHOOK_RECEIVED", { payloadType: typeof payload });
    return respond({ success: true, service: "wa-webhook-core", requestId }, {
      status: 200,
    });
  } catch (err) {
    logEvent("CORE_WEBHOOK_ERROR", {
      error: err instanceof Error ? err.message : String(err),
    }, "error");
    return respond({ error: "internal_error", requestId }, {
      status: 500,
    });
  }
  
  try {
    const decision = routeIncomingPayload(payload);
    const forwarded = await forwardToEdgeService(decision, payload, req.headers);
    return finalize(forwarded, correlationId, requestStart, decision.service);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      event: "WA_WEBHOOK_CORE_ERROR",
      correlationId,
      message,
    }));
    return finalize(new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }), correlationId, requestStart);
  }
});

function finalize(
  response: Response,
  correlationId: string,
  requestStart: number,
  routedService = "wa-webhook-core",
): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Correlation-ID", correlationId);
  headers.set("X-Routed-Service", routedService);

  const durationMs = latencyTracker.recordLatency(performance.now() - requestStart, correlationId);
  headers.set("X-WA-Core-Latency", `${Math.round(durationMs)}ms`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
