import { NormalizedPayload, WhatsAppMessage, WhatsAppWebhookPayload } from "./types.ts";

const encoder = new TextEncoder();

export async function verifySignature(
  req: Request,
  rawBody: string,
  appSecret: string,
): Promise<boolean> {
  if (!appSecret) return false;
  const header = req.headers.get("x-hub-signature-256") ?? "";
  if (!header.startsWith("sha256=")) return false;
  const theirHex = header.slice(7);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const ourBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const ourBytes = new Uint8Array(ourBuf);
  const theirBytes = hexToBytes(theirHex);
  if (ourBytes.length !== theirBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < ourBytes.length; i++) {
    diff |= ourBytes[i] ^ theirBytes[i];
  }
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const len = clean.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function normalizePayload(payload: WhatsAppWebhookPayload): NormalizedPayload[] {
  const normalized: NormalizedPayload[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      const metadata = value.metadata;
      for (const msg of value.messages ?? []) {
        const base: NormalizedPayload = {
          from: msg.from,
          messageId: msg.id,
          type: msg.type,
          metadata: {
            phoneNumberId: metadata?.phone_number_id,
            displayPhoneNumber: metadata?.display_phone_number,
          },
        };
        applyText(msg, base);
        applyInteractive(msg, base);
        applyMedia(msg, base);
        normalized.push(base);
      }
    }
  }
  return normalized;
}

function applyText(msg: WhatsAppMessage, base: NormalizedPayload): void {
  if (msg.type === "text" && msg.text?.body) {
    base.text = msg.text.body;
    base.keyword = extractKeyword(msg.text.body);
  }
}

function applyInteractive(msg: WhatsAppMessage, base: NormalizedPayload): void {
  if (msg.type !== "interactive" || !msg.interactive) return;
  if (msg.interactive.button_reply) {
    base.interactive = {
      type: "button_reply",
      id: msg.interactive.button_reply.id,
      title: msg.interactive.button_reply.title,
    };
    base.keyword = extractKeyword(msg.interactive.button_reply.id);
  } else if (msg.interactive.list_reply) {
    base.interactive = {
      type: "list_reply",
      id: msg.interactive.list_reply.id,
    };
    base.keyword = extractKeyword(msg.interactive.list_reply.id);
  }
}

function applyMedia(msg: WhatsAppMessage, base: NormalizedPayload): void {
  if (msg.type === "image" && msg.image) {
    base.media = { type: "image", id: msg.image.id, caption: msg.image.caption };
    if (msg.image.caption) base.keyword = extractKeyword(msg.image.caption);
  } else if (msg.type === "document" && msg.document) {
    base.media = { type: "document", id: msg.document.id, caption: msg.document.caption };
    if (msg.document.caption) base.keyword = extractKeyword(msg.document.caption);
  }
}

export function extractKeyword(text: string): string | undefined {
  const cleaned = text.toLowerCase().trim();
  if (!cleaned) return undefined;
  return cleaned
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9_-]/g, ""))
    .find((token) => token.length > 0);
}

export function truncate(str: string | undefined, length: number): string | undefined {
  if (!str) return undefined;
  return str.length <= length ? str : `${str.slice(0, length)}…`;
}
