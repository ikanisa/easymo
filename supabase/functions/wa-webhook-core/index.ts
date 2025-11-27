import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/wa-webhook-shared/config.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { forwardToEdgeService, routeIncomingPayload, summarizeServiceHealth } from "./router.ts";
import { LatencyTracker } from "./telemetry.ts";
import { checkRateLimit, cleanupRateLimitState } from "../_shared/service-resilience.ts";
import { maskPhone } from "../_shared/phone-utils.ts";
import { logError } from "../_shared/correlation-logging.ts";
import { storeDLQEntry } from "../_shared/dlq-manager.ts";

const coldStartMarker = performance.now();


const latencyTracker = new LatencyTracker({
  windowSize: 120,
  coldStartSloMs: Number(Deno.env.get("WA_CORE_COLD_START_SLO_MS") ?? "1750") || 1750,
  p95SloMs: Number(Deno.env.get("WA_CORE_P95_SLO_MS") ?? "1200") || 1200,
});

// Request counter for deterministic cleanup scheduling
let requestCounter = 0;
const CLEANUP_INTERVAL = 100; // Cleanup every N requests

serve(async (req: Request): Promise<Response> => {
  requestCounter++;
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
    // Read raw body for signature verification
    const rawBody = await req.text();
    
    // Verify WhatsApp signature
    const signature = req.headers.get("x-hub-signature-256") ??
      req.headers.get("x-hub-signature");
    const signatureMeta = (() => {
      if (!signature) return { provided: false, header: null as string | null, method: null as string | null, sample: null as string | null };
      const header = req.headers.has("x-hub-signature-256")
        ? "x-hub-signature-256"
        : req.headers.has("x-hub-signature")
        ? "x-hub-signature"
        : null;
      const [method, hash] = signature.split("=", 2);
      return {
        provided: true,
        header,
        method: method?.toLowerCase() ?? null,
        sample: hash ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : null,
      };
    })();
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ??
      Deno.env.get("WA_APP_SECRET");
    const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";
    const internalForward = req.headers.get("x-wa-internal-forward") === "true";
    
    if (!appSecret) {
      log("CORE_AUTH_CONFIG_ERROR", { error: "WHATSAPP_APP_SECRET not configured" }, "error");
      return json({ error: "server_misconfigured" }, { status: 500 });
    }
    
    let isValid = false;
    if (signature) {
      isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
      if (isValid) {
        log("CORE_AUTH_SIGNATURE_VALID", {
          header: signatureMeta.header,
          method: signatureMeta.method,
        }, "debug");
      }
    }
    
    if (!isValid) {
      if (allowUnsigned || internalForward) {
        log("CORE_AUTH_BYPASS", {
          reason: internalForward ? "internal_forward" : signature ? "signature_mismatch" : "no_signature",
          signatureHeader: signatureMeta.header,
          signatureMethod: signatureMeta.method,
          signatureSample: signatureMeta.sample,
          userAgent: req.headers.get("user-agent"),
        }, "warn");
      } else {
        log("CORE_AUTH_FAILED", { 
          signatureProvided: signatureMeta.provided,
          signatureHeader: signatureMeta.header,
          signatureMethod: signatureMeta.method,
          signatureSample: signatureMeta.sample,
          userAgent: req.headers.get("user-agent") 
        }, "warn");
        return json({ error: "unauthorized" }, { status: 401 });
      }
    }
    
    // Parse payload after verification
    const payload = JSON.parse(rawBody);
    
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
          headers: { "Retry-After": String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
        });
      }
    }
    
    // Periodically cleanup rate limit state using deterministic counter
    if (requestCounter % CLEANUP_INTERVAL === 0) {
      cleanupRateLimitState();
    }
    
    log("CORE_WEBHOOK_RECEIVED", { payloadType: typeof payload });
    const decision = await routeIncomingPayload(payload);
    log("CORE_ROUTING_DECISION", { 
      service: decision.service, 
      reason: decision.reason,
      routingText: decision.routingText 
    });
    const forwarded = await forwardToEdgeService(decision, payload, req.headers);
    return finalize(forwarded, decision.service);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("WA_WEBHOOK_CORE_ERROR", { correlationId, message }, { correlationId });
    
    // Store failed message in DLQ for retry
    try {
      const rawBody = await req.clone().text();
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
          error_type: err instanceof Error ? err.constructor.name : "UnknownError",
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
        dlqError: dlqError instanceof Error ? dlqError.message : String(dlqError),
      }, { correlationId });
    }
    
    return finalize(new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { "Content-Type": "application/json" } }));
  }
});

/**
 * Extract phone number from WhatsApp webhook payload
 */
function extractPhoneFromPayload(payload: unknown): string | null {
  try {
    const p = payload as { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from?: string }> } }> }> };
    const messages = p?.entry?.[0]?.changes?.[0]?.value?.messages;
    if (Array.isArray(messages) && messages.length > 0) {
      return messages[0]?.from ?? null;
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

// maskPhone is imported from phone-utils.ts
