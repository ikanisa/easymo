import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  const { ride_id, vehicle_type, pickup, limit = 8 } = await req.json();
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable", reqId }, { status: 503 });
  }
  const { data, error } = await supabase.rpc("nearest_drivers", { p_lat: pickup.lat, p_lng: pickup.lng, p_vehicle: vehicle_type, p_limit: limit });
  if (error) return NextResponse.json({ error, reqId }, { status: 400 });
  return NextResponse.json({ ride_id, drivers: data, reqId }, { status: 200 });
}

export async function GET(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  return NextResponse.json({ route: "mobility.match", status: "ok", reqId }, { status: 200 });
}
