import { serve } from "./deps.ts";
import {
  supabase,
  WA_BOT_NUMBER_E164,
  WA_PHONE_ID,
  WA_VERIFY_TOKEN,
} from "./config.ts";
import { verifySignature } from "./wa/verify.ts";
import { handleMessage } from "./router/router.ts";
import { claimEvent, releaseEvent } from "./state/idempotency.ts";
import {
  ensureProfile,
  getState,
  InvalidWhatsAppNumberError,
} from "./state/store.ts";
import { maybeRunRetention } from "./state/retention.ts";
import { logEvent, logInbound, logStructuredEvent } from "./observe/log.ts";
import { logMetric } from "./observe/logging.ts";
import { coerceToSupportedLanguage, resolveLanguage } from "./i18n/language.ts";

type ChangeRecord = { value?: { contacts?: unknown[] } };

const MAX_REQUEST_BYTES = Math.max(
  Number(Deno.env.get("WA_WEBHOOK_MAX_BYTES") ?? "262144") || 262144,
  1024,
);

class PayloadTooLargeError extends Error {
  constructor(readonly bytes: number) {
    super("payload_too_large");
  }
}

function normalizeWaId(id: string): string {
  return id.startsWith("+") ? id : `+${id}`;
}

function normalizeDisplayNumber(number: string): string {
  const trimmed = number.trim();
  if (!trimmed) return trimmed;
  const digits = trimmed.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
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

function buildContactLocaleIndex(changes: ChangeRecord[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const change of changes ?? []) {
    const contacts = Array.isArray(change?.value?.contacts)
      ? change.value.contacts
      : [];
    for (const contact of contacts) {
      if (!contact || typeof contact !== "object") continue;
      const record = contact as Record<string, unknown>;
      const waIdRaw = getStringField(record, "wa_id") ??
        getStringField(record, "waId");
      if (!waIdRaw) continue;
      const localeCandidate = extractLocaleCandidate(record);
      if (!localeCandidate) continue;
      const normalizedNumber = normalizeWaId(waIdRaw);
      index.set(normalizedNumber, localeCandidate);
      index.set(normalizedNumber.replace(/^\+/, ""), localeCandidate);
    }
  }
  return index;
}

function getStringField(
  source: Record<string, unknown> | undefined,
  key: string,
): string | null {
  if (!source) return null;
  const value = source[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function extractLocaleCandidate(
  contact: Record<string, unknown>,
): string | null {
  const profile = ("profile" in contact && contact.profile &&
      typeof contact.profile === "object")
    ? contact.profile as Record<string, unknown>
    : undefined;
  const candidates = [
    getStringField(profile, "language"),
    getStringField(profile, "locale"),
    getStringField(contact, "language"),
    getStringField(contact, "locale"),
  ];
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return null;
}

function detectMessageLanguage(
  msg: any,
  contactLocales: Map<string, string>,
): string | null {
  const directCandidates = [
    msg?.language?.code,
    msg?.language,
    msg?.context?.language,
    msg?.context?.locale,
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (typeof msg?.from !== "string" || !msg.from.trim()) return null;
  const normalized = normalizeWaId(msg.from.trim());
  return contactLocales.get(normalized) ??
    contactLocales.get(normalized.replace(/^\+/, "")) ??
    null;
}

function isTargetPhoneNumber(change: any): boolean {
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

serve(async (req: Request): Promise<Response> => {
  await logStructuredEvent("WEBHOOK_REQUEST_RECEIVED", {
    method: req.method,
    url: req.url,
  });
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (
      url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === WA_VERIFY_TOKEN
    ) {
      await logStructuredEvent("SIG_VERIFY_OK", { mode: "GET" });
      return new Response(url.searchParams.get("hub.challenge") ?? "", {
        status: 200,
      });
    }
    await logStructuredEvent("SIG_VERIFY_FAIL", { mode: "GET" });
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const requestStart = Date.now();
  const declaredLength = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    await logStructuredEvent("WEBHOOK_BODY_TOO_LARGE", {
      declared_bytes: declaredLength,
      limit: MAX_REQUEST_BYTES,
    });
    return new Response("payload_too_large", { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await readRequestBodyWithLimit(req, MAX_REQUEST_BYTES);
  } catch (err) {
    if (err instanceof PayloadTooLargeError) {
      await logStructuredEvent("WEBHOOK_BODY_TOO_LARGE", {
        read_bytes: err.bytes,
        limit: MAX_REQUEST_BYTES,
      });
      return new Response("payload_too_large", { status: 413 });
    }
    throw err;
  }
  await logStructuredEvent("WEBHOOK_BODY_READ", { bytes: rawBody.length });

  if (!(await verifySignature(req, rawBody))) {
    console.warn("wa_webhook.sig_fail");
    await logStructuredEvent("SIG_VERIFY_FAIL", { mode: "POST" });
    return new Response("sig", { status: 401 });
  }
  await logStructuredEvent("SIG_VERIFY_OK", { mode: "POST" });

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("wa_webhook.bad_json", err);
    await logStructuredEvent("WEBHOOK_BODY_PARSE_FAIL", { error: String(err) });
    return new Response("bad_json", { status: 400 });
  }

  await logInbound(payload);

  const allChanges = payload?.entry?.flatMap((entry: any) =>
    entry?.changes ?? []
  ) ??
    [];
  const filteredChanges = allChanges.filter(isTargetPhoneNumber);
  const ignoredChanges = allChanges.length - filteredChanges.length;
  if (ignoredChanges > 0) {
    await logStructuredEvent("WEBHOOK_PHONE_MISMATCH_IGNORED", {
      ignored: ignoredChanges,
      total: allChanges.length,
    });
  }
  const messages = filteredChanges.flatMap((change: any) =>
    change?.value?.messages ?? []
  );
  const contactLocales = buildContactLocaleIndex(filteredChanges);

  if (!messages.length) {
    await logStructuredEvent("WEBHOOK_NO_MESSAGE", {
      payload_type: payload?.object ?? null,
    });
  }

  for (const msg of messages) {
    if (!msg?.id) continue;
    const claimed = await claimEvent(msg.id);
    await logStructuredEvent(claimed ? "IDEMPOTENCY_MISS" : "IDEMPOTENCY_HIT", {
      message_id: msg.id,
    });
    if (!claimed) continue;

    const from = msg.from?.startsWith("+") ? msg.from : `+${msg.from}`;
    const candidateLanguage = detectMessageLanguage(msg, contactLocales);
    const messageLanguage = coerceToSupportedLanguage(candidateLanguage);
    let profile;
    try {
      profile = await ensureProfile(
        supabase,
        from,
        messageLanguage ?? undefined,
      );
    } catch (error) {
      if (error instanceof InvalidWhatsAppNumberError) {
        await logMetric("wa_message_invalid_sender", 1, {});
        continue;
      }
      throw error;
    }
    const normalizedFrom = profile.whatsapp_e164 ?? from;
    const state = await getState(supabase, profile.user_id);
    const resolvedLocale = resolveLanguage(
      messageLanguage ?? undefined,
      profile.locale ?? undefined,
    );
    const messageStart = Date.now();
    try {
      await handleMessage(
        {
          supabase,
          from: normalizedFrom,
          profileId: profile.user_id,
          locale: resolvedLocale,
        },
        msg,
        state,
      );
      await logMetric("wa_message_processed", 1, {
        type: msg.type ?? "unknown",
      });
      await logStructuredEvent("MESSAGE_LATENCY", {
        message_id: msg.id,
        ms: Date.now() - messageStart,
        type: msg.type ?? null,
      });
    } catch (err) {
      await releaseEvent(msg.id);
      await logStructuredEvent("IDEMPOTENCY_RELEASE", {
        message_id: msg.id,
        reason: err instanceof Error ? err.message : String(err),
      });
      await logMetric("wa_message_failed", 1, {
        type: msg.type ?? "unknown",
      });
      throw err;
    }
  }

  const entryCount = Array.isArray(payload?.entry) ? payload.entry.length : 0;
  await logEvent("wa-webhook", {
    status_code: 200,
    entry_count: entryCount,
    message_count: messages.length,
    object: typeof payload?.object === "string" ? payload.object : null,
    processing_ms: Date.now() - requestStart,
  });
  await logStructuredEvent("WEBHOOK_RESPONSE", {
    status: 200,
    messageCount: messages.length,
  });
  await logMetric("wa_webhook_request_ms", Date.now() - requestStart, {
    messageCount: messages.length,
  });

  await maybeRunRetention();

  return new Response("ok", { status: 200 });
});
