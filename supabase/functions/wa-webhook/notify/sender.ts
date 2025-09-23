import { supabase, WA_PHONE_ID, WA_TOKEN } from "../config.ts";

export type NotificationPayload = {
  to: string;
  template?: { name: string; language?: string; components?: unknown[] };
  text?: string;
  flow?: { flow_id: string };
};

export async function queueNotification(payload: NotificationPayload, meta: { type: string; orderId?: string } = { type: "generic" }): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    to_wa_id: payload.to,
    template_name: payload.template?.name ?? null,
    notification_type: meta.type,
    order_id: meta.orderId ?? null,
    payload,
    channel: payload.template ? "template" : payload.flow ? "flow" : "freeform",
  });
  if (error) throw error;
}

export async function processNotificationQueue(limit = 10): Promise<void> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, to_wa_id, payload")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("notify.fetch", error);
    return;
  }
  for (const row of data ?? []) {
    try {
      await deliver(row.to_wa_id, row.payload);
      await supabase.from("notifications").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id);
    } catch (err) {
      console.error("notify.send_fail", row.id, err);
      await supabase.from("notifications").update({ status: "failed", error_message: String(err) }).eq("id", row.id);
    }
  }
}

async function deliver(to: string, payload: any): Promise<void> {
  const body: any = {
    messaging_product: "whatsapp",
    to,
  };
  if (payload.template) {
    body.type = "template";
    body.template = {
      name: payload.template.name,
      language: { code: payload.template.language ?? "en" },
      components: payload.template.components ?? [],
    };
  } else if (payload.flow) {
    body.type = "flow";
    body.flow = { name: payload.flow.flow_id, language: { code: "en" } };
  } else if (payload.text) {
    body.type = "text";
    body.text = { body: payload.text };
  } else {
    throw new Error("Unsupported notification payload");
  }
  const res = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}
