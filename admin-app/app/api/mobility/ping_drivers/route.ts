import { NextRequest, NextResponse } from "next/server";

import { logStructured } from "@/lib/server/logger";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  const { ride_id, driver_ids = [], text, delaySeconds } = await req.json();

  if (!ride_id || !text) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const recipients = Array.isArray(driver_ids)
    ? driver_ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  if (recipients.length === 0) {
    return NextResponse.json({ ride_id, queued: 0, reqId }, { status: 202 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "supabase_unavailable", message: "Supabase credentials missing. Unable to queue notifications." },
      { status: 503 },
    );
  }

  const deliverAfter = typeof delaySeconds === "number" && delaySeconds > 0
    ? new Date(Date.now() + delaySeconds * 1000).toISOString()
    : null;

  const payloadBase = {
    type: "mobility_invite",
    text,
  };

  const rows = recipients.map((to) => ({
    to_wa_id: to,
    notification_type: "mobility_ping",
    channel: "freeform",
    payload: payloadBase,
    status: "queued",
    retry_count: 0,
    deliver_after: deliverAfter,
    metadata: { ride_id },
  }));

  const { data, error } = await admin
    .from("notifications")
    .insert(rows)
    .select("id,to_wa_id,status");

  if (error) {
    console.error("mobility.ping_drivers.insert_failed", { error });
    return NextResponse.json({ error: "notifications_insert_failed", message: "Unable to queue notifications." }, { status: 500 });
  }

  const queued = data?.length ?? 0;

  try {
    await admin.functions.invoke("notification-worker", { body: {} });
  } catch (workerError) {
    console.warn("mobility.ping_drivers.worker_trigger_failed", workerError);
  }

  logStructured({
    event: "mobility.ping_drivers.queued",
    status: queued === recipients.length ? "ok" : "degraded",
    details: { rideId: ride_id, queued, total: recipients.length, reqId },
  });

  return NextResponse.json({ ride_id, queued, reqId }, { status: 202 });
}

export async function GET(req: NextRequest) {
  const enabled = (process.env.API_HEALTH_PROBES_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  return NextResponse.json({ route: "mobility.ping_drivers", status: "ok", reqId }, { status: 200 });
}

export const runtime = "nodejs";
