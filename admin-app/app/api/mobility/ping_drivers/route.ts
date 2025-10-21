import { NextRequest, NextResponse } from "next/server";

// Fan-out to drivers via existing WA sender /api/wa/outbound/messages
export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  const { ride_id, driver_ids = [], template } = await req.json();
  // TODO: for each driver phone, call your WA outbound sender with the template
  return NextResponse.json({ queued: driver_ids.length, reqId }, { status: 202 });
}

export async function GET(req: NextRequest) {
  const enabled = (process.env.API_HEALTH_PROBES_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  return NextResponse.json({ route: "mobility.ping_drivers", status: "ok", reqId }, { status: 200 });
}
