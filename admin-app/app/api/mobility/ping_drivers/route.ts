import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const idem = req.headers.get("Idempotency-Key") || undefined;
  try {
    const { ride_id, driver_ids, template } = await req.json();
    console.log(JSON.stringify({ evt: "mobility.ping_drivers", reqId, idem, ride_id, count: Array.isArray(driver_ids) ? driver_ids.length : 0 }));
    // TODO: integrate with WhatsApp outbound sender
    return NextResponse.json({ queued: Array.isArray(driver_ids) ? driver_ids.length : 0, reqId }, { status: 202 });
  } catch (err: any) {
    console.error(JSON.stringify({ evt: "mobility.ping_drivers.error", reqId, message: err?.message }));
    return NextResponse.json({ error: "internal_error", reqId }, { status: 500 });
  }
}

