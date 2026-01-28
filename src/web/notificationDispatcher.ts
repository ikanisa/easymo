import { writeAuditEvent } from "../audit/writeAuditEvent";
import { getWebSupabaseClient } from "./client";

type NotificationRow = {
  id: string;
  channel: "web" | "whatsapp" | "email";
  payload: Record<string, unknown>;
  post_id: string;
  target_type: string;
  target_id: string;
};

const MAX_BATCH = 25;

function resolvePhone(payload: Record<string, unknown>): string | null {
  const phone = payload["phone"] ?? payload["whatsapp_number"] ?? payload["target_phone"]; // eslint-disable-line @typescript-eslint/no-unsafe-member-access
  return typeof phone === "string" && phone.trim() ? phone.trim() : null;
}

async function sendWhatsappRpc(phone: string, message: string): Promise<void> {
  // Read at call-time so tests and runtime config changes are respected.
  const whatsappEndpoint = process.env.WHATSAPP_SEND_ENDPOINT;

  if (!whatsappEndpoint) {
    throw new Error("whatsapp_endpoint_unconfigured");
  }

  const response = await fetch(whatsappEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: phone, type: "text", text: { body: message } }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`whatsapp_send_failed:${response.status}:${text}`);
  }
}

export type DispatchResult = {
  notificationId: string;
  status: "sent" | "failed";
  reason?: string;
};

export async function dispatchQueuedNotifications(limit = MAX_BATCH): Promise<DispatchResult[]> {
  const client = getWebSupabaseClient();
  const { data, error } = await client
    .from("web_notifications")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`notifications_query_failed:${error.message}`);
  }

  const rows = (data ?? []) as NotificationRow[];
  if (!rows.length) {
    return [];
  }

  const results: DispatchResult[] = [];
  for (const row of rows) {
    let status: DispatchResult["status"] = "sent";
    let reason: string | undefined;

    try {
      if (row.channel === "whatsapp") {
        const phone = resolvePhone(row.payload);
        const text = String(row.payload["message"] ?? row.payload["body"] ?? "You have a marketplace update.");
        if (!phone) {
          throw new Error("whatsapp_missing_target_phone");
        }
        await sendWhatsappRpc(phone, text);
      } else if (row.channel === "email") {
        status = "failed";
        reason = "email_channel_not_implemented";
      }
    } catch (error) {
      status = "failed";
      reason = error instanceof Error ? error.message : String(error);
    }

    const { error: updateError } = await client
      .from("web_notifications")
      .update({
        status,
        delivered_at: status === "sent" ? new Date().toISOString() : null,
        error_message: reason ?? null,
      })
      .eq("id", row.id);

    if (updateError) {
      throw new Error(`notification_update_failed:${updateError.message}`);
    }

    await writeAuditEvent({
      request_id: row.post_id,
      event_type: "web_notification.dispatch",
      actor: "system",
      input: { notification: row.id, target: row.target_id, channel: row.channel },
      output: { status, reason },
    });

    results.push({ notificationId: row.id, status, reason });
  }

  return results;
}
