import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(req: NextRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });

  const { to, text, template, media, interactive, type, delaySeconds } = await req.json();
  if (!to || (!text && !template && !media && !interactive)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Insert a queued notification row; notification-worker will deliver.
  const payload: Record<string, unknown> = { text, template, media, interactive };
  const insertPayload: Record<string, unknown> = {
    to_wa_id: to,
    notification_type: template?.name ?? type ?? "generic",
    template_name: template?.name ?? null,
    channel: template ? "template" : "freeform",
    payload,
    status: "queued",
    retry_count: 0,
    deliver_after: delaySeconds ? new Date(Date.now() + Number(delaySeconds) * 1000).toISOString() : null,
  };

  const { data, error } = await admin.from("notifications").insert(insertPayload).select("id").single();
  if (error) return NextResponse.json({ error }, { status: 400 });

  // Trigger the worker asynchronously (best-effort)
  try {
    await admin.functions.invoke("notification-worker", { body: {} });
  } catch (_) {
    // non-blocking
  }

  return NextResponse.json({ id: data.id }, { status: 202 });
}


export const runtime = "edge";
