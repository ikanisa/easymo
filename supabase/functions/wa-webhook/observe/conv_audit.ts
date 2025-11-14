import { WA_BOT_NUMBER_E164 } from "../config.ts";
import type { RouterContext } from "../types.ts";

const DEFAULT_RECIPIENT: string | null =
  typeof WA_BOT_NUMBER_E164 === "string" && WA_BOT_NUMBER_E164.trim().length
    ? WA_BOT_NUMBER_E164.trim()
    : null;

function getThreadId(msg: any): string | null {
  if (msg?.context && typeof msg.context === "object") {
    const id = (msg.context as any).id;
    if (typeof id === "string" && id.trim().length) return id.trim();
  }
  return null;
}

function coerceString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseMessageTimestamp(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const millis = raw > 9_999_999_999 ? raw : raw * 1000;
    return new Date(millis).toISOString();
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed.length) return null;
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      const millis = asNumber > 9_999_999_999 ? asNumber : asNumber * 1000;
      return new Date(millis).toISOString();
    }
  }
  return null;
}

function buildMetadataSnapshot(msg: unknown): Record<string, unknown> {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return {};
  const record = msg as Record<string, unknown>;
  const snapshot: Record<string, unknown> = {};

  const candidates: Array<[string, unknown]> = [
    ["context", record.context],
    ["interactive", record.interactive],
    ["location", record.location],
    ["referral", record.referral],
    ["button", record.button],
    ["image", record.image],
    ["document", record.document],
    ["audio", record.audio],
    ["video", record.video],
    ["sticker", record.sticker],
    ["errors", record.errors],
    ["system", record.system],
  ];

  for (const [key, value] of candidates) {
    if (!value) continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      snapshot[key] = value;
      continue;
    }
    if (typeof value === "object") {
      if (!Object.keys(value as Record<string, unknown>).length) continue;
      snapshot[key] = value;
      continue;
    }
    snapshot[key] = value;
  }

  const text = record.text;
  if (text && typeof text === "object") {
    const textRecord = text as Record<string, unknown>;
    const body = textRecord.body;
    if (typeof body === "string" && body.trim().length) {
      snapshot.text = { body: body.trim() };
    } else if (Object.keys(textRecord).length) {
      snapshot.text = textRecord;
    }
  }

  return snapshot;
}

export async function recordInbound(
  ctx: RouterContext,
  msg: any,
): Promise<void> {
  try {
    const { data: driver } = await ctx.supabase
      .from("drivers")
      .select("id")
      .eq("phone_e164", ctx.from)
      .maybeSingle();

    const waThreadId = getThreadId(msg);
    let conversationId: string | null = null;

    // Try create a conversation row (best-effort; allow duplicates gracefully)
    try {
      const { data: conv } = await ctx.supabase
        .from("conversations")
        .insert({
          channel: "whatsapp",
          role: driver ? "driver" : "user",
          driver_id: driver?.id ?? null,
          contact_id: null,
          wa_thread_id: waThreadId,
        })
        .select("id")
        .single();
      conversationId = conv?.id ?? null;
    } catch (_) {
      // Fall back to latest conversation by driver
      if (driver?.id) {
        const { data: latest } = await ctx.supabase
          .from("conversations")
          .select("id")
          .eq("driver_id", driver.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        conversationId = latest?.id ?? null;
      }
    }

    // Insert message payload (dir=in)
    const { data: insertedMessage } = await ctx.supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        dir: "in",
        body: msg,
      })
      .select("id, conversation_id, created_at")
      .single();

    if (insertedMessage?.id) {
      const record = msg as Record<string, unknown>;
      const metadataRecord: Record<string, unknown> = {
        message_id: insertedMessage.id,
        conversation_id: insertedMessage.conversation_id ?? conversationId,
        direction: "inbound",
        sender_msisdn: ctx.from,
        recipient_msisdn:
          coerceString(record["to"]) ??
          coerceString(record["recipient_id"]) ??
          DEFAULT_RECIPIENT,
        wa_message_id: coerceString(record["id"]),
        message_type: coerceString(record["type"]),
        status: "received",
      };

      const sentAt = parseMessageTimestamp(record["timestamp"]);
      if (sentAt) metadataRecord.sent_at = sentAt;

      const metadataSnapshot = buildMetadataSnapshot(msg);
      if (Object.keys(metadataSnapshot).length) {
        metadataRecord.metadata = metadataSnapshot;
      }

      if (insertedMessage.created_at) {
        metadataRecord.created_at = insertedMessage.created_at;
        metadataRecord.updated_at = insertedMessage.created_at;
      }

      await ctx.supabase.from("message_metadata").insert(metadataRecord);
    }
  } catch (_) {
    // Non-blocking audit; ignore failures
  }
}
