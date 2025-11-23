import { WA_BOT_NUMBER_E164, WA_PHONE_ID, WA_VERIFY_TOKEN, webhookConfig } from "../config.ts";
import { logInbound, logStructuredEvent } from "../observe/log.ts";
import { verifySignature } from "../wa/verify.ts";
import {
  buildContactLocaleIndex,
  normalizeDisplayNumber,
} from "../utils/locale.ts";
import type {
  RawWhatsAppMessage,
  WhatsAppMessage,
  WhatsAppWebhookChange,
  WhatsAppWebhookPayload,
} from "../types.ts";
import { getCached, setCached } from "../utils/cache.ts";
import { incrementMetric } from "../utils/metrics_collector.ts";

const MAX_REQUEST_BYTES = Math.max(
  Number(Deno.env.get("WA_WEBHOOK_MAX_BYTES") ?? "262144") || 262144,
  1024,
);

const ADMIN_BYPASS_TOKEN = Deno.env.get("EASYMO_ADMIN_TOKEN") ?? "";

// Simple in-memory rate limiter (per IP) with fixed window
type WindowCounter = { count: number; windowStart: number };
const rlStore = new Map<string, WindowCounter>();

function getClientIp(req: Request): string {
  const h = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  const ip = h.split(",")[0].trim();
  return ip || "unknown";
}

async function checkRateLimit(req: Request): Promise<PreparedResponse | null> {
  if (!webhookConfig.rateLimit?.enabled) return null;
  const windowMs = webhookConfig.rateLimit.windowMs ?? 60_000;
  const maxReq = webhookConfig.rateLimit.maxRequests ?? 100;
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${webhookConfig.rateLimit.keyPrefix || "wa"}:${ip}`;

  // Prefer distributed limiter via Upstash REST if configured
  const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  if (upstashUrl && upstashToken) {
    try {
      const k = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
      // INCR key; if first increment, set expiry
      const incrRes = await fetch(`${upstashUrl}/INCR/${encodeURIComponent(k)}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
      const incrJson = await incrRes.json();
      const count = Number(incrJson.result ?? incrJson) || 0;
      if (count === 1) {
        // set expiration in seconds
        await fetch(`${upstashUrl}/EXPIRE/${encodeURIComponent(k)}/${Math.ceil(windowMs / 1000)}`, {
          headers: { Authorization: `Bearer ${upstashToken}` },
        }).catch((error) => {
          console.error(JSON.stringify({
            event: "RATE_LIMIT_EXPIRE_FAILED",
            error: error instanceof Error ? error.message : String(error),
            key: k
          }));
        });
      }
      if (count > maxReq) {
        return {
          type: "response",
          response: new Response("too_many_requests", { status: 429 }),
          correlationId: req.headers.get("x-correlation-id") ?? crypto.randomUUID(),
        };
      }
      return null;
    } catch (_) {
      // Fall through to in-memory limiter on any error
    }
  }

  const entry = rlStore.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    rlStore.set(key, { count: 1, windowStart: now });
    return null;
  }
  entry.count += 1;
  if (entry.count > maxReq) {
    return {
      type: "response",
      response: new Response("too_many_requests", { status: 429 }),
      correlationId: req.headers.get("x-correlation-id") ?? crypto.randomUUID(),
    };
  }
  return null;
}

class PayloadTooLargeError extends Error {
  constructor(readonly bytes: number) {
    super("payload_too_large");
  }
}

type PipelineHooks = {
  verifySignature: typeof verifySignature;
  logInbound: typeof logInbound;
  logStructuredEvent: typeof logStructuredEvent;
};

const defaultHooks: PipelineHooks = {
  verifySignature,
  logInbound,
  logStructuredEvent,
};

let hooks: PipelineHooks = { ...defaultHooks };

export function __setPipelineTestOverrides(
  overrides: Partial<PipelineHooks>,
): void {
  hooks = { ...hooks, ...overrides };
}

export function __resetPipelineTestOverrides(): void {
  hooks = { ...defaultHooks };
}

async function readRequestBodyWithLimit(
  request: Request,
  limit: number,
): Promise<string> {
  const body = request.body;
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limit) {
      throw new PayloadTooLargeError(total);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function isTargetPhoneNumber(change: WhatsAppWebhookChange): boolean {
  const metadata = change?.value?.metadata;
  if (!metadata || typeof metadata !== "object") {
    return false;
  }
  const phoneId = typeof metadata.phone_number_id === "string"
    ? metadata.phone_number_id.trim()
    : "";
  if (phoneId && phoneId !== WA_PHONE_ID) {
    return false;
  }
  const displayRaw = typeof metadata.display_phone_number === "string"
    ? metadata.display_phone_number
    : "";
  if (displayRaw) {
    const displayNormalized = normalizeDisplayNumber(displayRaw);
    // Allow runtime override for testing
    const configuredNumber = Deno.env.get("WA_BOT_NUMBER_E164") ?? WA_BOT_NUMBER_E164;
    const configured = configuredNumber
      ? normalizeDisplayNumber(configuredNumber)
      : "";
    if (configured && displayNormalized !== configured) {
      return false;
    }
  }
  return true;
}

function coerceMessages(
  candidates: RawWhatsAppMessage[] | undefined,
): WhatsAppMessage[] {
  const messages: WhatsAppMessage[] = [];
  for (const candidate of candidates ?? []) {
    if (!candidate || typeof candidate !== "object") continue;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const from = typeof candidate.from === "string" ? candidate.from.trim() : "";
    const type = typeof candidate.type === "string" ? candidate.type.trim() : "";
    if (!id || !from || !type) continue;
    messages.push({
      ...(candidate as Record<string, unknown>),
      id,
      from,
      type,
    });
  }
  return messages;
}

function dedupeMessages(messages: WhatsAppMessage[]): WhatsAppMessage[] {
  const seen = new Set<string>();
  const result: WhatsAppMessage[] = [];
  for (const msg of messages) {
    if (seen.has(msg.id)) continue;
    seen.add(msg.id);
    result.push(msg);
  }
  return result;
}

export type PreparedWebhook = {
  type: "messages";
  payload: WhatsAppWebhookPayload;
  messages: WhatsAppMessage[];
  contactLocales: Map<string, string>;
  requestStart: number;
  correlationId: string;
};

export type PreparedResponse = {
  type: "response";
  response: Response;
  correlationId: string;
};

export async function processWebhookRequest(
  req: Request,
): Promise<PreparedWebhook | PreparedResponse> {
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const startedAt = Date.now();
  const withCid = (payload: Record<string, unknown> = {}) => ({
    correlationId,
    ...payload,
  });

  console.log(JSON.stringify({
    event: "WEBHOOK_REQUEST_RECEIVED",
    correlationId,
    method: req.method,
    url: req.url,
    timestamp: new Date(startedAt).toISOString(),
  }));
  await hooks.logStructuredEvent("WEBHOOK_REQUEST_RECEIVED", withCid({
    method: req.method,
    url: req.url,
  }));
  incrementMetric("wa_webhook_request_received_total", 1, {
    method: req.method,
  });

  if (req.method === "GET") {
    const url = new URL(req.url);
    
    // Check if this is a WhatsApp webhook verification request
    if (url.searchParams.has("hub.mode") || url.searchParams.has("hub.verify_token")) {
      if (
        url.searchParams.get("hub.mode") === "subscribe" &&
        url.searchParams.get("hub.verify_token") === WA_VERIFY_TOKEN
      ) {
      const cacheKey = `wa:webhook:challenge:${url.searchParams.toString()}`;
      if (webhookConfig.cache.enabled) {
        const cachedChallenge = getCached<string>(cacheKey);
        if (cachedChallenge) {
          console.log(JSON.stringify({
            event: "WEBHOOK_CHALLENGE_CACHE_HIT",
            correlationId,
            cacheKey,
          }));
          await hooks.logStructuredEvent(
            "WEBHOOK_CHALLENGE_CACHE_HIT",
            withCid({ cache_key: cacheKey }),
          );
          incrementMetric("wa_webhook_cache_hits_total", 1, { scope: "challenge" });
          return {
            type: "response",
            response: new Response(cachedChallenge, { status: 200 }),
            correlationId,
          };
        }
      }

      await hooks.logStructuredEvent("SIG_VERIFY_OK", withCid({ mode: "GET" }));
      if (webhookConfig.cache.enabled) {
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        setCached(cacheKey, challenge, webhookConfig.cache.defaultTTL);
        incrementMetric("wa_webhook_cache_misses_total", 1, { scope: "challenge" });
      }
      return {
        type: "response",
        response: new Response(url.searchParams.get("hub.challenge") ?? "", {
          status: 200,
        }),
        correlationId,
      };
      }
      // Invalid verification token
      await hooks.logStructuredEvent("SIG_VERIFY_FAIL", withCid({ mode: "GET" }));
      incrementMetric("wa_webhook_request_failed_total", 1, {
        method: "GET",
        reason: "verification",
        status: 403,
      });
      return {
        type: "response",
        response: new Response("forbidden", { status: 403 }),
        correlationId,
      };
    }
    
    // Plain GET request (not WhatsApp verification) - return info
    return {
      type: "response",
      response: new Response(JSON.stringify({
        service: "WhatsApp Webhook",
        status: "active",
        version: "2.0",
        endpoints: {
          webhook: "POST /",
          health: "GET /health",
          metrics: "GET /metrics"
        },
        info: "WhatsApp webhook verification requires hub.mode, hub.verify_token, and hub.challenge parameters"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }),
      correlationId,
    };
  }

  if (req.method !== "POST") {
    incrementMetric("wa_webhook_request_failed_total", 1, {
      method: req.method,
      reason: "method_not_allowed",
      status: 405,
    });
    return {
      type: "response",
      response: new Response("Method Not Allowed", { status: 405 }),
      correlationId,
    };
  }

  const requestStart = Date.now();

  // Early rate limit check (per IP)
  const rlViolation = await checkRateLimit(req);
  if (rlViolation) {
    await hooks.logStructuredEvent("WEBHOOK_RATE_LIMIT", withCid({ reason: "ip_window_exceeded" }));
    incrementMetric("wa_webhook_request_failed_total", 1, { method: "POST", reason: "rate_limit", status: 429 });
    return rlViolation;
  }
  const declaredLength = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    await hooks.logStructuredEvent("WEBHOOK_BODY_TOO_LARGE", withCid({
      declared_bytes: declaredLength,
      limit: MAX_REQUEST_BYTES,
    }));
    incrementMetric("wa_webhook_request_failed_total", 1, {
      method: "POST",
      reason: "payload_too_large",
      status: 413,
    });
    return {
      type: "response",
      response: new Response("payload_too_large", { status: 413 }),
      correlationId,
    };
  }

  let rawBody: string;
  try {
    rawBody = await readRequestBodyWithLimit(req, MAX_REQUEST_BYTES);
  } catch (err) {
    if (err instanceof PayloadTooLargeError) {
      await hooks.logStructuredEvent("WEBHOOK_BODY_TOO_LARGE", withCid({
        read_bytes: err.bytes,
        limit: MAX_REQUEST_BYTES,
      }));
      incrementMetric("wa_webhook_request_failed_total", 1, {
        method: "POST",
        reason: "payload_too_large",
        status: 413,
      });
      return {
        type: "response",
        response: new Response("payload_too_large", { status: 413 }),
        correlationId,
      };
    }
    throw err;
  }
  await hooks.logStructuredEvent("WEBHOOK_BODY_READ", withCid({ bytes: rawBody.length }));

  // Signature verification policy
  const envFlag = (Deno.env.get("APP_ENV") ?? Deno.env.get("NODE_ENV") ?? "").toLowerCase();
  const isProd = envFlag === "production";
  const bypassEnabled = (Deno.env.get("WA_ADMIN_BYPASS_ENABLED") ?? "").toLowerCase() !== "false";
  const adminBypassCandidate = Boolean(ADMIN_BYPASS_TOKEN && req.headers.get("x-admin-token") === ADMIN_BYPASS_TOKEN);
  let adminBypass = false;
  if (!isProd && bypassEnabled && adminBypassCandidate) {
    const allowlist = (Deno.env.get("WA_ADMIN_BYPASS_IPS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (allowlist.length === 0) {
      adminBypass = true;
    } else {
      const ip = getClientIp(req);
      adminBypass = allowlist.includes(ip);
    }
  }
  const shouldVerify = webhookConfig.verification.enabled !== false && !adminBypass;
  if (shouldVerify) {
    const verified = await hooks.verifySignature(req, rawBody);
    if (!verified) {
      console.warn("wa_webhook.sig_fail");
      await hooks.logStructuredEvent("SIG_VERIFY_FAIL", withCid({
        mode: "POST",
        reason: "mismatch",
      }));
      incrementMetric("wa_webhook_request_failed_total", 1, {
        method: "POST",
        reason: "signature",
        status: 401,
      });
      return {
        type: "response",
        response: new Response("sig", { status: 401 }),
        correlationId,
      };
    }
    await hooks.logStructuredEvent("SIG_VERIFY_OK", withCid({ mode: "POST" }));
  } else {
    await hooks.logStructuredEvent("SIG_VERIFY_SKIPPED", withCid({
      mode: "POST",
      reason: adminBypass ? "admin_bypass" : "disabled",
    }));
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("wa_webhook.bad_json", err);
    await hooks.logStructuredEvent("WEBHOOK_BODY_PARSE_FAIL", withCid({
      error: String(err),
    }));
    incrementMetric("wa_webhook_request_failed_total", 1, {
      method: "POST",
      reason: "bad_json",
      status: 400,
    });
    return {
      type: "response",
      response: new Response("bad_json", { status: 400 }),
      correlationId,
    };
  }

  await hooks.logInbound(payload);

  const allChanges: WhatsAppWebhookChange[] = payload?.entry?.flatMap((entry) =>
    entry?.changes ?? []
  ) ?? [];
  const filteredChanges = allChanges.filter(isTargetPhoneNumber);
  const ignoredChanges = allChanges.length - filteredChanges.length;
  if (ignoredChanges > 0) {
    await hooks.logStructuredEvent("WEBHOOK_PHONE_MISMATCH_IGNORED", withCid({
      ignored: ignoredChanges,
      total: allChanges.length,
    }));
  }
  const normalizedMessages = filteredChanges.flatMap((change) =>
    coerceMessages(change?.value?.messages)
  );
  const messages = dedupeMessages(normalizedMessages);
  const duplicateCount = normalizedMessages.length - messages.length;
  if (duplicateCount > 0) {
    await hooks.logStructuredEvent("WEBHOOK_DUPLICATE_MESSAGES_IGNORED", withCid({
      duplicates: duplicateCount,
      total: normalizedMessages.length,
    }));
  }
  const contactLocales = buildContactLocaleIndex(filteredChanges);

  if (!messages.length) {
    await hooks.logStructuredEvent("WEBHOOK_NO_MESSAGE", withCid({
      payload_type: payload?.object ?? null,
    }));
  }

  if (webhookConfig.cache.enabled) {
    for (const msg of messages) {
      const cacheKey = `wa:webhook:cid:msg:${msg.id}`;
      setCached(cacheKey, correlationId, webhookConfig.cache.defaultTTL);
    }
  }

  incrementMetric("wa_webhook_request_success_total", 1, {
    method: "POST",
    messageCount: messages.length,
  });
  console.log(JSON.stringify({
    event: "WEBHOOK_REQUEST_READY",
    correlationId,
    messageCount: messages.length,
  }));

  return {
    type: "messages",
    payload,
    messages,
    contactLocales,
    requestStart,
    correlationId,
  };
}
