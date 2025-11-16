import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
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
      service: "wa-webhook-property",
      requestId,
      path: url.pathname,
      ...details,
    }, level);
  };

  logEvent("PROPERTY_WEBHOOK_REQUEST", {
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    const startedAt = Date.now();
    try {
      const { error } = await supabase.from("properties").select("id").limit(1);
      const healthy = !error;

      logEvent("PROPERTY_HEALTH_CHECK", {
        healthy,
        durationMs: Date.now() - startedAt,
        error: error?.message,
      }, healthy ? "info" : "warn");

      return respond({
        status: healthy ? "healthy" : "unhealthy",
        service: "wa-webhook-property",
        timestamp: new Date().toISOString(),
        requestId,
        checks: { database: healthy ? "connected" : "disconnected" },
        metrics: { duration_ms: Date.now() - startedAt },
        version: "1.0.0",
      }, { status: healthy ? 200 : 503 });
    } catch (err) {
      logEvent("PROPERTY_HEALTH_CHECK_ERROR", {
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      }, "error");

      return respond({
        status: "unhealthy",
        service: "wa-webhook-property",
        requestId,
        error: err instanceof Error ? err.message : String(err),
      }, { status: 503 });
    }
  }

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return respond(challenge, { status: 200 });
    }
    return respond({ error: "forbidden" }, { status: 403 });
  }

  try {
    const payload = await req.json();
    logEvent("PROPERTY_MESSAGE_PROCESSED", { payloadType: typeof payload });
    return respond({ success: true, service: "wa-webhook-property", requestId }, {
      status: 200,
    });
  } catch (err) {
    logEvent("PROPERTY_WEBHOOK_ERROR", {
      error: err instanceof Error ? err.message : String(err),
    }, "error");
    return respond({ error: "internal_error", requestId }, {
      status: 500,
    });
  }
});

console.log("✅ wa-webhook-property service started");
