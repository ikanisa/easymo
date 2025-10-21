import type {
  WhatsAppDocumentMessage,
  WhatsAppInteractiveButtonMessage,
  WhatsAppInteractiveListMessage,
  WhatsAppInteractiveMessage,
  WhatsAppLocationMessage,
  WhatsAppMediaMessage,
  WhatsAppMessage,
  WhatsAppTextMessage,
} from "../types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableRecord(
  value: unknown,
): value is Record<string, unknown> | null | undefined {
  return value === null || value === undefined || isRecord(value);
}

function isInteractiveBase(
  msg: WhatsAppMessage,
): msg is WhatsAppInteractiveMessage {
  if (msg.type !== "interactive") return false;
  const interactive = (msg as { interactive?: unknown }).interactive;
  return isNullableRecord(interactive);
}

export function isTextMessage(
  msg: WhatsAppMessage,
): msg is WhatsAppTextMessage {
  if (msg.type !== "text") return false;
  const text = (msg as { text?: unknown }).text;
  return isNullableRecord(text);
}

export function isInteractiveButtonMessage(
  msg: WhatsAppMessage,
): msg is WhatsAppInteractiveButtonMessage {
  if (!isInteractiveBase(msg)) return false;
  const interactive = (msg as WhatsAppInteractiveMessage).interactive;
  if (!interactive) return false;
  const type = typeof interactive.type === "string" ? interactive.type : null;
  if (type && type !== "button_reply") return false;
  return isRecord(interactive.button_reply ?? null);
}

export function isInteractiveListMessage(
  msg: WhatsAppMessage,
): msg is WhatsAppInteractiveListMessage {
  if (!isInteractiveBase(msg)) return false;
  const interactive = (msg as WhatsAppInteractiveMessage).interactive;
  if (!interactive) return false;
  const type = typeof interactive.type === "string" ? interactive.type : null;
  if (type && type !== "list_reply") return false;
  return isRecord(interactive.list_reply ?? null);
}

export function isLocationMessage(
  msg: WhatsAppMessage,
): msg is WhatsAppLocationMessage {
  if (msg.type !== "location") return false;
  const location = (msg as { location?: unknown }).location;
  return isNullableRecord(location);
}

function isImageMessage(msg: WhatsAppMessage): msg is WhatsAppMediaMessage {
  if (msg.type !== "image") return false;
  const image = (msg as { image?: unknown }).image;
  return isNullableRecord(image);
}

function isDocumentMessage(
  msg: WhatsAppMessage,
): msg is WhatsAppDocumentMessage {
  if (msg.type !== "document") return false;
  const document = (msg as { document?: unknown }).document;
  return isNullableRecord(document);
}

export function isMediaMessage(
  msg: WhatsAppMessage,
): msg is WhatsAppMediaMessage {
  return isImageMessage(msg) || isDocumentMessage(msg);
}

export function getTextBody(
  msg: WhatsAppTextMessage,
): string | null {
  const body = msg.text?.body;
  if (typeof body !== "string") return null;
  const trimmed = body.trim();
  return trimmed.length ? trimmed : null;
}

export function getButtonReplyId(
  msg: WhatsAppInteractiveButtonMessage,
): string | null {
  const id = msg.interactive?.button_reply?.id;
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  return trimmed.length ? trimmed : null;
}

export function getListReplyId(
  msg: WhatsAppInteractiveListMessage,
): string | null {
  const id = msg.interactive?.list_reply?.id;
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  return trimmed.length ? trimmed : null;
}
