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
    const configured = WA_BOT_NUMBER_E164
      ? normalizeDisplayNumber(WA_BOT_NUMBER_E164)
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

  if (!(await hooks.verifySignature(req, rawBody))) {
    console.warn("wa_webhook.sig_fail");
    await hooks.logStructuredEvent("SIG_VERIFY_FAIL", withCid({ mode: "POST" }));
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
