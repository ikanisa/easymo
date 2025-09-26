import type { SupabaseClient } from "../deps.ts";
import {
  supabase as sharedSupabase,
  WA_PHONE_ID,
  WA_TOKEN,
} from "../config.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { emitAlert } from "../observe/alert.ts";

const WHATSAPP_API_BASE_URL = Deno.env.get("WHATSAPP_API_BASE_URL") ??
  "https://graph.facebook.com/v20.0";
const DEFAULT_TEMPLATE_LANGUAGE =
  Deno.env.get("WHATSAPP_TEMPLATE_DEFAULT_LANGUAGE") ?? "en";
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

export const TEMPLATE_ORDER_CREATED_VENDOR =
  Deno.env.get("TEMPLATE_ORDER_CREATED_VENDOR") ?? "order_created_vendor";
export const TEMPLATE_ORDER_PENDING_VENDOR =
  Deno.env.get("TEMPLATE_ORDER_PENDING_VENDOR") ?? "order_pending_vendor";
export const TEMPLATE_ORDER_PAID_CUSTOMER =
  Deno.env.get("TEMPLATE_ORDER_PAID_CUSTOMER") ?? "order_paid_customer";
export const TEMPLATE_ORDER_SERVED_CUSTOMER =
  Deno.env.get("TEMPLATE_ORDER_SERVED_CUSTOMER") ?? "order_served_customer";
export const TEMPLATE_ORDER_CANCELLED_CUSTOMER =
  Deno.env.get("TEMPLATE_ORDER_CANCELLED_CUSTOMER") ??
    "order_cancelled_customer";
export const TEMPLATE_CART_REMINDER =
  Deno.env.get("TEMPLATE_CART_REMINDER_CUSTOMER") ?? "cart_reminder_customer";

const WA_MESSAGES_ENDPOINT = `${WHATSAPP_API_BASE_URL}/${WA_PHONE_ID}/messages`;
const DEFAULT_NOTIFICATION_TYPE = "generic";

export type MediaPayload = {
  type: "image" | "document" | "audio" | "video" | "sticker";
  link: string;
  caption?: string;
  filename?: string;
};

export type TemplatePayload = {
  name: string;
  language?: string;
  components?: unknown;
};

export type QueueNotificationMessage = {
  to: string;
  template?: TemplatePayload;
  text?: string;
  media?: MediaPayload;
};

export type QueueNotificationOptions = {
  supabase?: SupabaseClient;
  orderId?: string;
  type?: string;
  delaySeconds?: number;
} & Record<string, unknown>;

export type QueueNotificationResult = { id: string };

export type QueueVendorOrderCreatedParams = {
  to: string;
  orderCode: string;
  totalText: string;
  table?: string | null;
  orderId?: string;
  supabase?: SupabaseClient;
};

export type QueueCustomerStatusParams = {
  to: string;
  status: "paid" | "served" | "cancelled";
  orderCode: string;
  totalMinor?: number;
  currency?: string;
  reason?: string;
  orderId?: string;
  supabase?: SupabaseClient;
};

export type QueueStaffInviteParams = {
  to: string;
  barName: string;
  code: string;
  expiresInHours?: number;
  supabase?: SupabaseClient;
};

type NotificationChannel = "template" | "freeform" | "flow";

type NotificationRow = {
  id: string;
  to_wa_id: string;
  payload?: unknown;
  channel?: NotificationChannel;
  template_name?: string | null;
  notification_type?: string | null;
  retry_count?: number | null;
};

type ClaimedRow = NotificationRow & {
  status?: string;
};

type MessageEnvelope = {
  template?: TemplatePayload;
  text?: string;
  media?: MediaPayload;
  meta?: Record<string, unknown>;
};

class WhatsAppSendError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown) {
    const summary = typeof detail === "string" ? detail : JSON.stringify(
      detail,
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
    );
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
      : envelope.template?.name ?? DEFAULT_NOTIFICATION_TYPE;
  const channel: NotificationChannel = envelope.template
    ? "template"
    : "freeform";
  const meta = buildMeta(options, notificationType);
  const delay = resolveDelay(options.delaySeconds);

  const insertPayload: Record<string, unknown> = {
    to_wa_id: normalizedTo,
    notification_type: notificationType,
    template_name: envelope.template?.name ?? null,
    order_id: typeof options.orderId === "string" ? options.orderId : null,
    channel,
    payload: envelope,
    status: "queued",
    retry_count: 0,
  };

  if (delay > 0) {
    insertPayload.next_attempt_at = new Date(Date.now() + delay * 1000)
      .toISOString();
  }

  if (Object.keys(meta).length) {
    insertPayload.payload = { ...envelope, meta };
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
    channel,
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
    .select("id, to_wa_id, payload, channel, notification_type, retry_count")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw error ?? new Error(`Notification ${id} not found`);
  }

  const row: ClaimedRow = {
    id: data.id,
    to_wa_id: data.to_wa_id,
    payload: data.payload,
    channel: data.channel as NotificationChannel | undefined,
    notification_type: data.notification_type,
    retry_count: data.retry_count ?? 0,
  };

  await deliverNotification(row, supa);
}

export async function queueVendorOrderCreated(
  params: QueueVendorOrderCreatedParams,
): Promise<QueueNotificationResult> {
  const tableLabel = params.table && params.table.trim().length
    ? params.table.trim()
    : "Counter";
  return await queueNotification(
    {
      to: params.to,
      template: {
        name: TEMPLATE_ORDER_CREATED_VENDOR,
        language: DEFAULT_TEMPLATE_LANGUAGE,
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: params.orderCode },
              { type: "text", text: tableLabel },
              { type: "text", text: params.totalText },
            ],
          },
        ],
      },
    },
    {
      supabase: params.supabase,
      type: "order_created_vendor",
      orderId: params.orderId,
      table: tableLabel,
      total_text: params.totalText,
    },
  );
}

export async function queueCustomerStatusTemplate(
  params: QueueCustomerStatusParams,
): Promise<QueueNotificationResult> {
  const templateDef = buildCustomerTemplate(params);
  return await queueNotification(
    {
      to: params.to,
      template: {
        name: templateDef.name,
        language: DEFAULT_TEMPLATE_LANGUAGE,
        components: templateDef.components,
      },
    },
    {
      supabase: params.supabase,
      type: `order_${params.status}_customer`,
      orderId: params.orderId,
      reason: params.reason,
    },
  );
}

export async function queueStaffInvite(
  params: QueueStaffInviteParams,
): Promise<QueueNotificationResult> {
  const text = buildStaffInviteText(params);
  return await queueNotification(
    { to: params.to, text },
    {
      supabase: params.supabase,
      type: "staff_invite",
      bar: params.barName,
      expires_in_hours: params.expiresInHours ?? 24,
    },
  );
}

export async function processNotificationQueue(
  limit = 10,
  client?: SupabaseClient,
): Promise<
  Array<{ id: string; status: "sent" | "queued" | "failed"; error?: string }>
> {
  const supa = client ?? sharedSupabase;
  const claimed = await claimNotifications(supa, limit);
  if (!claimed.length) return [];
  const outcomes: Array<
    { id: string; status: "sent" | "queued" | "failed"; error?: string }
  > = [];

  for (const row of claimed) {
    try {
      await deliverNotification(row, supa);
      outcomes.push({ id: row.id, status: "sent" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = await handleDeliveryFailure(row, supa, error);
      outcomes.push({ id: row.id, status, error: message });
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

  const body = buildWhatsAppPayload(row.to_wa_id, message, row.channel);
  const response = await fetch(WA_MESSAGES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WA_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const responseJson = await safeJson(response);

  if (!response.ok) {
    throw new WhatsAppSendError(response.status, responseJson);
  }

  const updatePayload = {
    status: "sent",
    sent_at: nowIso(),
    retry_count: row.retry_count ?? 0,
    error_message: null as string | null,
    next_attempt_at: null as string | null,
    payload: mergeMeta(row.payload, {
      last_status: "sent",
      last_sent_at: nowIso(),
      message_id: responseJson?.messages?.[0]?.id ?? null,
      last_response: responseJson,
    }),
  };

  await supa
    .from("notifications")
    .update(updatePayload)
    .eq("id", row.id);

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
  const shouldFail = nextAttempts >= MAX_RETRIES;
  const backoffSeconds = shouldFail
    ? null
    : computeBackoffSeconds(nextAttempts);
  const errorMessage = error instanceof Error
    ? error.message
    : String(error ?? "unknown_error");

  const metaPatch: Record<string, unknown> = {
    last_status: "failed",
    last_error_at: nowIso(),
    last_error_message: errorMessage,
  };

  if (error instanceof WhatsAppSendError) {
    metaPatch.last_error_status = error.status;
    metaPatch.last_error_detail = error.detail;
  }

  const updatePayload: Record<string, unknown> = {
    retry_count: nextAttempts,
    status: shouldFail ? "failed" : "queued",
    error_message: errorMessage,
    payload: mergeMeta(row.payload, metaPatch),
  };

  if (backoffSeconds !== null) {
    updatePayload.next_attempt_at = new Date(Date.now() + backoffSeconds * 1000)
      .toISOString();
  } else {
    updatePayload.next_attempt_at = null;
  }

  await supa
    .from("notifications")
    .update(updatePayload)
    .eq("id", row.id);

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
  const hasTemplate = Boolean(message.template);
  const hasFreeform = Boolean(message.text) || Boolean(message.media);

  if (!hasTemplate && !hasFreeform) {
    throw new Error("Provide template, text, or media payload");
  }
  if (hasTemplate && hasFreeform) {
    throw new Error(
      "Template notifications cannot include text or media payload",
    );
  }

  const template = message.template
    ? {
      name: message.template.name,
      language: message.template.language ?? DEFAULT_TEMPLATE_LANGUAGE,
      components: message.template.components ?? [],
    }
    : undefined;

  const media = message.media
    ? {
      type: message.media.type,
      link: message.media.link,
      caption: message.media.caption,
      filename: message.media.filename,
    }
    : undefined;

  const envelope: MessageEnvelope = {};
  if (template) envelope.template = template;
  if (typeof message.text === "string") envelope.text = message.text;
  if (media) envelope.media = media;
  return envelope;
}

function buildMeta(
  options: QueueNotificationOptions,
  notificationType: string,
): Record<string, unknown> {
  const meta: Record<string, unknown> = { notification_type: notificationType };
  for (const [key, value] of Object.entries(options)) {
    if (
      key === "supabase" || key === "delaySeconds" || key === "orderId" ||
      key === "type"
    ) continue;
    meta[key] = value;
  }
  if (typeof options.orderId === "string") {
    meta.order_id = options.orderId;
  }
  return meta;
}

function resolveDelay(delaySeconds?: number): number {
  if (typeof delaySeconds === "number" && delaySeconds > 0) {
    return Math.floor(delaySeconds);
  }
  return DEFAULT_DELAY_SECONDS;
}

function buildCustomerTemplate(params: QueueCustomerStatusParams) {
  switch (params.status) {
    case "paid":
      return {
        name: TEMPLATE_ORDER_PAID_CUSTOMER,
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: params.orderCode },
            ],
          },
        ],
      };
    case "served":
      return {
        name: TEMPLATE_ORDER_SERVED_CUSTOMER,
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: params.orderCode },
            ],
          },
        ],
      };
    case "cancelled":
    default:
      return {
        name: TEMPLATE_ORDER_CANCELLED_CUSTOMER,
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: params.orderCode },
              { type: "text", text: params.reason ?? "Order cancelled" },
            ],
          },
        ],
      };
  }
}

function buildStaffInviteText(params: QueueStaffInviteParams): string {
  const expiresIn = params.expiresInHours ?? 24;
  return `EasyMO invite to ${params.barName}: reply with CODE ${params.code} within ${expiresIn}h to activate your staff access.`;
}

function extractMessage(row: NotificationRow): QueueNotificationMessage | null {
  const payload = row.payload;
  if (!isRecord(payload)) return fallbackFromLegacy(row);
  const message = isRecord(payload.message) ? payload.message : payload;
  const template = isRecord(message.template)
    ? {
      name: String(message.template.name ?? row.template_name ?? ""),
      language: message.template.language as string | undefined,
      components: message.template.components,
    }
    : undefined;
  const text = typeof message.text === "string" ? message.text : undefined;
  const media = isRecord(message.media)
    ? {
      type: String(message.media.type ?? "image") as MediaPayload["type"],
      link: String(message.media.link ?? ""),
      caption: typeof message.media.caption === "string"
        ? message.media.caption
        : undefined,
      filename: typeof message.media.filename === "string"
        ? message.media.filename
        : undefined,
    }
    : undefined;

  const envelope: QueueNotificationMessage = { to: row.to_wa_id };
  if (template) envelope.template = template;
  if (text) envelope.text = text;
  if (media && media.link) envelope.media = media;
  return envelope.template || envelope.text || envelope.media ? envelope : null;
}

function fallbackFromLegacy(
  row: NotificationRow,
): QueueNotificationMessage | null {
  if (!isRecord(row.payload)) return null;
  const payload = row.payload as Record<string, unknown>;
  const envelope: QueueNotificationMessage = { to: row.to_wa_id };
  if (isRecord(payload.template)) {
    envelope.template = {
      name: String(payload.template.name ?? row.template_name ?? ""),
      language: payload.template.language as string | undefined,
      components: payload.template.components,
    };
  }
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
  return envelope.template || envelope.text || envelope.media ? envelope : null;
}

function buildWhatsAppPayload(
  to: string,
  message: QueueNotificationMessage,
  channel?: NotificationChannel,
) {
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
  };

  if ((channel === "template" || message.template) && message.template) {
    payload.type = "template";
    payload.template = {
      name: message.template.name,
      language: {
        code: message.template.language ?? DEFAULT_TEMPLATE_LANGUAGE,
      },
      components: message.template.components ?? [],
    };
    return payload;
  }

  if (message.media) {
    const media = {
      link: message.media.link,
      caption: message.media.caption,
    };
    if (message.media.filename && message.media.type === "document") {
      (media as Record<string, unknown>).filename = message.media.filename;
    }
    payload.type = message.media.type;
    payload[message.media.type] = pruneUndefined(media);
    return payload;
  }

  payload.type = "text";
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

function pruneUndefined(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== undefined) result[key] = val;
  }
  return result;
}

function isMissingFunctionError(
  error: { code?: string; message?: string },
): boolean {
  if (!error) return false;
  if (error.code === "42883") return true;
  if (!error.message) return false;
  return error.message.includes("function") &&
    error.message.includes("does not exist");
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}
