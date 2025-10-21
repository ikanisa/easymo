import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import type { SupabaseClient } from "../flow-exchange/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("SERVICE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_API_BASE_URL = Deno.env.get("WHATSAPP_API_BASE_URL") ??
  "https://graph.facebook.com/v20.0";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";

const sharedSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export interface TemplateNotification {
  supabase?: SupabaseClient;
  to: string;
  template: string;
  language?: string;
  components?: unknown;
  orderId?: string;
  type: string;
  payload?: Record<string, unknown>;
}

export async function sendTemplateNotification(params: TemplateNotification) {
  const language = params.language ?? "en_US";
  const client = params.supabase ?? sharedSupabase;

  const insertPayload = {
    order_id: params.orderId ?? null,
    to_wa_id: params.to,
    template_name: params.template,
    notification_type: params.type,
    channel: "template",
    status: "queued",
    payload: params.payload ?? params.components ?? {},
  };

  const { data: inserted, error: insertError } = await client
    .from("notifications")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError) {
    console.error("Failed to log notification", insertError);
    return { ok: false as const, error: insertError.message };
  }

  const body = {
    messaging_product: "whatsapp",
    to: params.to,
    type: "template",
    template: {
      name: params.template,
      language: { code: language },
      components: params.components ?? undefined,
    },
  };

  try {
    const response = await fetch(
      `${WHATSAPP_API_BASE_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(body),
      },
    );

    const json = await response.json().catch(() => ({}));

    if (response.ok) {
      await client
        .from("notifications")
        .update({
          status: "sent",
          payload: json,
          sent_at: new Date().toISOString(),
        })
        .eq("id", inserted.id);
      const messageId = json?.messages?.[0]?.id as string | undefined;
      return { ok: true as const, messageId };
    }

    await client
      .from("notifications")
      .update({ status: "failed", error_message: JSON.stringify(json) })
      .eq("id", inserted.id);

    console.error("Template send failed", json);
    return { ok: false as const, error: JSON.stringify(json) };
  } catch (error) {
    console.error("Template send error", error);
    await client
      .from("notifications")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq("id", inserted.id);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
