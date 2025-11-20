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
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

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
    const durationMs = latencyTracker.recordLatency(performance.now() - requestStart, correlationId);
    headers.set("X-WA-Core-Latency", `${Math.round(durationMs)}ms`);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };

  const log = (
    event: string,
    details: Record<string, unknown> = {},
    level: "debug" | "info" | "warn" | "error" = "info",
  ) => {
    logStructuredEvent(event, { service: "wa-webhook-core", requestId, path: url.pathname, ...details }, level);
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
      return json({ status: "unhealthy", service: "wa-webhook-core", error: message }, { status: 503 });
    }
  }

  // WhatsApp verification handshake (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { status: 200, headers: { "X-Request-ID": requestId, "X-Correlation-ID": correlationId } });
    }
    return json({ error: "forbidden" }, { status: 403 });
  }

  // Webhook ingress (POST)
  try {
    const payload = await req.json();
    log("CORE_WEBHOOK_RECEIVED", { payloadType: typeof payload });
    const decision = routeIncomingPayload(payload);
    const forwarded = await forwardToEdgeService(decision, payload, req.headers);
    return finalize(forwarded, decision.service);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "WA_WEBHOOK_CORE_ERROR", correlationId, message }));
    return finalize(new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { "Content-Type": "application/json" } }));
  }
});
