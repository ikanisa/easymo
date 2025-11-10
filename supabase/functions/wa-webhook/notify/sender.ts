import type { SupabaseClient } from "../deps.ts";
import {
  supabase as sharedSupabase,
  WA_PHONE_ID,
  WA_TOKEN,
} from "../config.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { emitAlert } from "../observe/alert.ts";
import { delay, fetchWithTimeout } from "../utils/http.ts";
import {
  calculateRateLimitBackoff,
  categorizeMetaError,
  extractMetaErrorCode,
  logDeliveryMetrics,
  processNotificationWithFilters,
} from "./processor.ts";

type QueueOutcome = {
  id: string;
  status: "sent" | "queued" | "failed";
  error?: string;
};

const WHATSAPP_API_BASE_URL = Deno.env.get("WHATSAPP_API_BASE_URL") ??
  "https://graph.facebook.com/v20.0";
const WA_MESSAGES_ENDPOINT = `${WHATSAPP_API_BASE_URL}/${WA_PHONE_ID}/messages`;
const DEFAULT_NOTIFICATION_TYPE = "generic";
const MAX_RETRIES = Math.max(
  Number(Deno.env.get("NOTIFY_MAX_RETRIES") ?? "5") || 5,
  1,
);
const BACKOFF_BASE_SECONDS = Math.max(
  Number(Deno.env.get("NOTIFY_BACKOFF_BASE_SECONDS") ?? "30") || 30,
  1,
);
const BACKOFF_MAX_SECONDS = Math.max(
  Number(Deno.env.get("NOTIFY_MAX_BACKOFF_SECONDS") ?? "900") || 900,
  BACKOFF_BASE_SECONDS,
);
const DEFAULT_DELAY_SECONDS = Math.max(
  Number(Deno.env.get("NOTIFY_DEFAULT_DELAY_SECONDS") ?? "0") || 0,
  0,
);
const STATUS_RETRY_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const STATUS_RETRIES = Math.max(
  Number(Deno.env.get("WA_HTTP_STATUS_RETRIES") ?? "2") || 2,
  0,
);
const STATUS_RETRY_DELAY_MS = Math.max(
  Number(Deno.env.get("WA_HTTP_STATUS_RETRY_DELAY_MS") ?? "400") || 400,
  0,
);

export type MediaPayload = {
  type: "image" | "document" | "audio" | "video" | "sticker";
  link: string;
  caption?: string;
  filename?: string;
};

type InteractiveListRow = {
  id: string;
  title: string;
  description?: string;
};

type InteractiveListPayload = {
  type: "list";
  headerText?: string;
  bodyText: string;
  buttonText: string;
  sectionTitle: string;
  rows: InteractiveListRow[];
};

type InteractivePayload = InteractiveListPayload;

export type QueueNotificationMessage = {
  to: string;
  text?: string;
  media?: MediaPayload;
  interactive?: InteractivePayload;
};

export type QueueNotificationOptions = {
  supabase?: SupabaseClient;
  type?: string;
  delaySeconds?: number;
} & Record<string, unknown>;

export type QueueNotificationResult = { id: string };

type MessageEnvelope = {
  text?: string;
  media?: MediaPayload;
  interactive?: InteractivePayload;
  meta?: Record<string, unknown>;
};

type NotificationRow = {
  id: string;
  to_wa_id: string;
  payload?: unknown;
  notification_type?: string | null;
  retry_count?: number | null;
};

type ClaimedRow = NotificationRow;

type WhatsAppPayload = {
  messaging_product: "whatsapp";
  to: string;
  type: string;
  text?: { body: string; preview_url?: boolean };
  interactive?: Record<string, unknown>;
  [key: string]: unknown;
};

class WhatsAppSendError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown) {
    const summary = typeof detail === "string"
      ? detail
      : JSON.stringify(detail, (_, value) =>
        typeof value === "bigint" ? value.toString() : value);
    super(`WhatsApp send failed (${status}): ${summary}`);
    this.status = status;
    this.detail = detail;
  }
}

export async function queueNotification(
  message: QueueNotificationMessage,
  options: QueueNotificationOptions = {},
): Promise<QueueNotificationResult> {
  const envelope = buildMessageEnvelope(message);
  const supa = options.supabase ?? sharedSupabase;
  const normalizedTo = normalizeWa(message.to);
  const notificationType =
    typeof options.type === "string" && options.type.length
      ? options.type
      : DEFAULT_NOTIFICATION_TYPE;
  const meta = buildMeta(options, notificationType);
  const delaySeconds = resolveDelay(options.delaySeconds);

  const payload = Object.keys(meta).length ? { ...envelope, meta } : envelope;

  const insertPayload: Record<string, unknown> = {
    to_wa_id: normalizedTo,
    notification_type: notificationType,
    payload,
    status: "queued",
    retry_count: 0,
  };

  if (delaySeconds > 0) {
    insertPayload.next_attempt_at = new Date(Date.now() + delaySeconds * 1000)
      .toISOString();
  }

  const { data, error } = await supa
    .from("notifications")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) throw error;

  await logStructuredEvent("NOTIFY_QUEUE", {
    id: data.id,
    to: maskWa(normalizedTo),
    type: notificationType,
  });

  return { id: data.id };
}

export async function sendNotificationNow(
  id: string,
  client?: SupabaseClient,
): Promise<void> {
  const supa = client ?? sharedSupabase;
  const { data, error } = await supa
    .from("notifications")
    .select("id, to_wa_id, payload, notification_type, retry_count")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw error ?? new Error(`Notification ${id} not found`);
  }

  const row: ClaimedRow = {
    id: data.id,
    to_wa_id: data.to_wa_id,
    payload: data.payload,
    notification_type: data.notification_type,
    retry_count: data.retry_count ?? 0,
  };

  await deliverNotification(row, supa);
}

export async function processNotificationQueue(
  limit = 10,
  client?: SupabaseClient,
): Promise<QueueOutcome[]> {
  const supa = client ?? sharedSupabase;
  const claimed = await claimNotifications(supa, limit);
  if (!claimed.length) return [];

  const outcomes: QueueOutcome[] = [];
  for (const row of claimed) {
    try {
      const filterCheck = await processNotificationWithFilters(row, supa);
      if (!filterCheck.shouldDeliver) {
        outcomes.push({
          id: row.id,
          status: filterCheck.deferUntil ? "queued" : "failed",
          error: filterCheck.reason,
        });
        await logDeliveryMetrics(
          row,
          filterCheck.deferUntil ? "deferred" : "failed",
        );
        continue;
      }

      await deliverNotification(row, supa);
      outcomes.push({ id: row.id, status: "sent" });
      await logDeliveryMetrics(row, "sent");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = await handleDeliveryFailure(row, supa, error);
      outcomes.push({ id: row.id, status, error: message });
      const metaCode = error instanceof WhatsAppSendError
        ? extractMetaErrorCode(error.detail)
        : null;
      await logDeliveryMetrics(
        row,
        status === "failed" ? "failed" : "deferred",
        metaCode,
      );
    }
  }

  return outcomes;
}

async function deliverNotification(
  row: ClaimedRow,
  supa: SupabaseClient,
): Promise<void> {
  const message = extractMessage(row);
  if (!message) {
    throw new Error(`Notification ${row.id} payload is empty`);
  }

  const body = buildWhatsAppPayload(row.to_wa_id, message);
  let attempt = 0;
  let response: Response | null = null;
  let responseJson: unknown = null;

  while (attempt <= STATUS_RETRIES) {
    response = await fetchWithTimeout(WA_MESSAGES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WA_TOKEN}`,
      },
      body: JSON.stringify(body),
    });
    responseJson = await safeJson(response);
    if (
      response.ok || !STATUS_RETRY_CODES.has(response.status) ||
      attempt >= STATUS_RETRIES
    ) {
      break;
    }
    if (STATUS_RETRY_DELAY_MS > 0) {
      await delay(STATUS_RETRY_DELAY_MS * Math.max(attempt, 1));
    }
    attempt += 1;
  }

  if (!response?.ok) {
    throw new WhatsAppSendError(response?.status ?? 500, responseJson);
  }

  const now = nowIso();
  const updatePayload = {
    status: "sent",
    sent_at: now,
    retry_count: row.retry_count ?? 0,
    error_message: null as string | null,
    next_attempt_at: null as string | null,
    payload: mergeMeta(row.payload, {
      last_status: "sent",
      last_sent_at: now,
      message_id: responseJson?.messages?.[0]?.id ?? null,
      last_response: responseJson,
    }),
  };

  await supa.from("notifications").update(updatePayload).eq("id", row.id);

  await logStructuredEvent("NOTIFY_SEND_OK", {
    id: row.id,
    to: maskWa(row.to_wa_id),
    message_id: responseJson?.messages?.[0]?.id ?? null,
  });
}

async function handleDeliveryFailure(
  row: ClaimedRow,
  supa: SupabaseClient,
  error: unknown,
): Promise<"queued" | "failed"> {
  const currentAttempts = typeof row.retry_count === "number"
    ? row.retry_count
    : 0;
  const nextAttempts = currentAttempts + 1;
  const metaErrorCode = error instanceof WhatsAppSendError
    ? extractMetaErrorCode(error.detail)
    : null;
  const errorCategory = categorizeMetaError(metaErrorCode);
  const shouldFail = errorCategory === "fail" || nextAttempts >= MAX_RETRIES;

  let backoffSeconds: number | null = null;
  if (!shouldFail) {
    backoffSeconds = errorCategory === "defer"
      ? calculateRateLimitBackoff(metaErrorCode, nextAttempts)
      : computeBackoffSeconds(nextAttempts);
  }

  const errorMessage = error instanceof Error
    ? error.message
    : String(error ?? "unknown_error");

  const now = nowIso();
  const updatePayload: Record<string, unknown> = {
    retry_count: nextAttempts,
    status: shouldFail ? "failed" : "queued",
    error_message: errorMessage,
    next_attempt_at: backoffSeconds !== null
      ? new Date(Date.now() + backoffSeconds * 1000).toISOString()
      : null,
    payload: mergeMeta(row.payload, {
      last_status: shouldFail ? "failed" : "queued",
      last_error_at: now,
      last_error_message: errorMessage,
      last_error_code: metaErrorCode,
      error_category: errorCategory,
    }),
  };

  await supa.from("notifications").update(updatePayload).eq("id", row.id);

  await logStructuredEvent("NOTIFY_SEND_FAIL", {
    id: row.id,
    to: maskWa(row.to_wa_id),
    retry: nextAttempts,
    status: updatePayload.status,
    error: errorMessage,
  });

  if (updatePayload.status === "failed") {
    await emitAlert("NOTIFY_SEND_FAIL", {
      id: row.id,
      to: maskWa(row.to_wa_id),
      error: errorMessage,
      retry: nextAttempts,
    });
  }

  return updatePayload.status as "queued" | "failed";
}

async function claimNotifications(
  supa: SupabaseClient,
  limit: number,
): Promise<ClaimedRow[]> {
  const functions = ["security.claim_notifications", "claim_notifications"];
  for (const fn of functions) {
    const { data, error } = await supa.rpc(fn, { _limit: limit });
    if (!error) {
      return (data ?? []) as ClaimedRow[];
    }
    if (!isMissingFunctionError(error)) {
      throw error;
    }
  }
  return [];
}

function buildMessageEnvelope(
  message: QueueNotificationMessage,
): MessageEnvelope {
  const hasText = typeof message.text === "string" && message.text.length > 0;
  const hasMedia = Boolean(message.media);
  const hasInteractive = Boolean(message.interactive);

  if (!hasText && !hasMedia && !hasInteractive) {
    throw new Error("Provide text, media, or interactive payload");
  }
  if (hasInteractive && (hasText || hasMedia)) {
    throw new Error(
      "Interactive notifications cannot include additional text or media payload",
    );
  }

  const envelope: MessageEnvelope = {};
  if (hasText) envelope.text = message.text;
  if (message.media) envelope.media = message.media;
  if (message.interactive) envelope.interactive = message.interactive;
  return envelope;
}

function buildMeta(
  options: QueueNotificationOptions,
  notificationType: string,
): Record<string, unknown> {
  const meta: Record<string, unknown> = { notification_type: notificationType };
  for (const [key, value] of Object.entries(options)) {
    if (key === "supabase" || key === "delaySeconds" || key === "type") {
      continue;
    }
    meta[key] = value;
  }
  return meta;
}

function resolveDelay(delaySeconds?: number): number {
  if (typeof delaySeconds === "number" && delaySeconds > 0) {
    return Math.floor(delaySeconds);
  }
  return DEFAULT_DELAY_SECONDS;
}

function extractMessage(row: NotificationRow): QueueNotificationMessage | null {
  if (!isRecord(row.payload)) {
    return fallbackFromLegacy(row);
  }
  const message = isRecord(row.payload.message)
    ? row.payload.message
    : row.payload;
  const text = typeof message.text === "string" ? message.text : undefined;
  const media =
    isRecord(message.media) && typeof message.media.link === "string"
      ? {
        type: String(message.media.type ?? "image") as MediaPayload["type"],
        link: message.media.link,
        caption: typeof message.media.caption === "string"
          ? message.media.caption
          : undefined,
        filename: typeof message.media.filename === "string"
          ? message.media.filename
          : undefined,
      }
      : undefined;
  const interactive = isRecord(message.interactive)
    ? normalizeInteractive(message.interactive)
    : undefined;

  const envelope: QueueNotificationMessage = { to: row.to_wa_id };
  if (text) envelope.text = text;
  if (media) envelope.media = media;
  if (interactive) envelope.interactive = interactive;
  return envelope.text || envelope.media || envelope.interactive
    ? envelope
    : null;
}

function fallbackFromLegacy(
  row: NotificationRow,
): QueueNotificationMessage | null {
  if (!isRecord(row.payload)) return null;
  const payload = row.payload as Record<string, unknown>;
  const envelope: QueueNotificationMessage = { to: row.to_wa_id };
  if (typeof payload.text === "string") {
    envelope.text = payload.text;
  }
  if (isRecord(payload.media) && typeof payload.media.link === "string") {
    envelope.media = {
      type: String(payload.media.type ?? "image") as MediaPayload["type"],
      link: payload.media.link,
      caption: typeof payload.media.caption === "string"
        ? payload.media.caption
        : undefined,
      filename: typeof payload.media.filename === "string"
        ? payload.media.filename
        : undefined,
    };
  }
  if (isRecord(payload.interactive)) {
    const interactive = normalizeInteractive(payload.interactive);
    if (interactive) envelope.interactive = interactive;
  }
  return envelope.text || envelope.media || envelope.interactive
    ? envelope
    : null;
}

function normalizeInteractive(
  value: Record<string, unknown>,
): InteractivePayload | undefined {
  const type = String(value.type ?? "");
  if (type !== "list") return undefined;
  const bodyRecord = isRecord(value.body) ? value.body : {};
  const actionRecord = isRecord(value.action) ? value.action : {};
  const sections = Array.isArray(actionRecord.sections)
    ? actionRecord.sections
    : [];
  const firstSection = isRecord(sections[0]) ? sections[0] : {};
  const bodyCandidate = typeof value.bodyText === "string"
    ? value.bodyText
    : typeof bodyRecord.text === "string"
    ? bodyRecord.text
    : undefined;
  const buttonCandidate = typeof value.buttonText === "string"
    ? value.buttonText
    : typeof actionRecord.button === "string"
    ? actionRecord.button
    : undefined;
  const sectionCandidate = typeof value.sectionTitle === "string"
    ? value.sectionTitle
    : typeof firstSection.title === "string"
    ? firstSection.title
    : undefined;
  const rowsSource = Array.isArray(value.rows)
    ? value.rows
    : Array.isArray(firstSection.rows)
    ? firstSection.rows
    : [];
  const rows: InteractiveListRow[] = rowsSource
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .map((row) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      description: typeof row.description === "string"
        ? row.description
        : undefined,
    }))
    .filter((row) => row.id.length && row.title.length)
    .slice(0, 10);

  if (!bodyCandidate || !buttonCandidate || !sectionCandidate || !rows.length) {
    return undefined;
  }

  const headerRecord = isRecord(value.header) ? value.header : {};
  const headerCandidate = typeof value.headerText === "string"
    ? value.headerText
    : typeof headerRecord.text === "string"
    ? headerRecord.text
    : undefined;

  return {
    type: "list",
    bodyText: bodyCandidate,
    buttonText: buttonCandidate,
    sectionTitle: sectionCandidate,
    rows,
    headerText: headerCandidate,
  };
}

function buildWhatsAppPayload(
  to: string,
  message: QueueNotificationMessage,
): WhatsAppPayload {
  const payload: WhatsAppPayload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
  };

  if (message.interactive) {
    payload.type = "interactive";
    payload.interactive = {
      type: "list",
      header: message.interactive.headerText
        ? { type: "text", text: message.interactive.headerText }
        : undefined,
      body: { text: message.interactive.bodyText },
      action: {
        button: message.interactive.buttonText,
        sections: [
          {
            title: message.interactive.sectionTitle,
            rows: message.interactive.rows.map((row) => ({
              id: row.id,
              title: row.title,
              description: row.description,
            })),
          },
        ],
      },
    };
    return payload;
  }

  if (message.media) {
    payload.type = message.media.type;
    payload[message.media.type] = pruneUndefined({
      link: message.media.link,
      caption: message.media.caption,
      filename: message.media.type === "document"
        ? message.media.filename
        : undefined,
    });
    return payload;
  }

  payload.text = {
    body: message.text ?? "",
    preview_url: false,
  };
  return payload;
}

function mergeMeta(
  payload: unknown,
  patch: Record<string, unknown>,
): MessageEnvelope {
  const base: MessageEnvelope = isRecord(payload)
    ? { ...(payload as MessageEnvelope) }
    : {};
  const currentMeta = isRecord(base.meta) ? { ...base.meta } : {};
  base.meta = { ...currentMeta, ...patch };
  return base;
}

function computeBackoffSeconds(attempt: number): number {
  const factor = Math.max(attempt - 1, 0);
  const raw = BACKOFF_BASE_SECONDS * (2 ** factor);
  return Math.min(raw, BACKOFF_MAX_SECONDS);
}

function normalizeWa(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("+")) return trimmed;
  return `+${trimmed.replace(/^\+/, "")}`;
}

function maskWa(wa: string): string {
  const normalized = normalizeWa(wa);
  if (normalized.length <= 4) return normalized;
  return `***${normalized.slice(-4)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingFunctionError(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  if (error.code === "42883") return true;
  if (!error.message) return false;
  return /function .* does not exist/i.test(error.message);
}

async function safeJson(response: Response | null): Promise<unknown> {
  if (!response) return null;
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

function pruneUndefined(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== undefined) result[key] = val;
  }
  return result;
}
