import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  const { ride_id, driver_id } = await req.json();
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable", reqId }, { status: 503 });
  }
  await supabase.from("rides").update({ status: "booked" }).eq("id", ride_id);
  // TODO: notify both sides via WhatsApp
  return NextResponse.json({ booked: true, ride_id, driver_id, reqId }, { status: 200 });
}

export async function GET(req: NextRequest) {
  const enabled = (process.env.API_HEALTH_PROBES_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const reqId = req.headers.get("x-request-id") || undefined;
  return NextResponse.json({ route: "mobility.book", status: "ok", reqId }, { status: 200 });
}

export const runtime = "nodejs";
