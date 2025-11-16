// wa-webhook-mobility - Standalone version
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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
      service: "wa-webhook-mobility",
      requestId,
      path: url.pathname,
      ...details,
    }, level);
  };

  logEvent("MOBILITY_WEBHOOK_REQUEST", {
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Health check
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    const startedAt = Date.now();
    try {
      const { error } = await supabase.from("trips").select("id").limit(1);
      const healthy = !error;

      logEvent("MOBILITY_HEALTH_CHECK", {
        healthy,
        durationMs: Date.now() - startedAt,
        error: error?.message,
      }, healthy ? "info" : "warn");

      return respond({
        status: healthy ? "healthy" : "unhealthy",
        service: "wa-webhook-mobility",
        timestamp: new Date().toISOString(),
        requestId,
        checks: { database: healthy ? "connected" : "disconnected" },
        metrics: { duration_ms: Date.now() - startedAt },
        version: "1.0.0",
        ...(error && { error: error.message }),
      }, { status: healthy ? 200 : 503 });
    } catch (err) {
      logEvent("MOBILITY_HEALTH_CHECK_ERROR", {
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      }, "error");

      return respond({
        status: "unhealthy",
        service: "wa-webhook-mobility",
        requestId,
        error: err instanceof Error ? err.message : String(err),
      }, { status: 503 });
    }
  }

  // Webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return respond(challenge, { status: 200 });
    }
    return respond({ error: "forbidden" }, { status: 403 });
  }

  // Main webhook handler
  try {
    const payload = await req.json();

    logEvent("MOBILITY_WEBHOOK_RECEIVED", {
      entryCount: payload.entry?.length || 0,
    });

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];

        for (const message of messages) {
          logEvent("MOBILITY_MESSAGE_RECEIVED", {
            id: message.id,
            from: message.from,
            type: message.type,
            textPreview: message.text?.body?.slice(0, 100),
          }, "debug");
        }
      }
    }

    return respond({
      success: true,
      service: "wa-webhook-mobility",
      requestId,
    }, {
      status: 200,
    });
  } catch (err) {
    logEvent("MOBILITY_WEBHOOK_ERROR", {
      error: err instanceof Error ? err.message : String(err),
    }, "error");

    return respond({
      error: "internal_error",
      service: "wa-webhook-mobility",
      requestId,
    }, {
      status: 500,
    });
  }
});

console.log("✅ wa-webhook-mobility service started");
