import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const idem = req.headers.get("Idempotency-Key") || undefined;
  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { ride_id, vehicle_type, pickup, limit = 8 } = await req.json();

    console.log(JSON.stringify({ evt: "mobility.match", reqId, idem, ride_id, vehicle_type, pickup }));

    // Try RPC if exists, else fallback to simple join (distance-agnostic)
    let drivers: any[] = [];
    const rpc = await supabase.rpc("nearest_drivers", {
      p_lat: pickup?.lat,
      p_lng: pickup?.lng,
      p_vehicle: vehicle_type ?? null,
      p_limit: limit,
    });
    if (!rpc.error && Array.isArray(rpc.data)) {
      drivers = rpc.data;
    } else {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, display_name, vehicle_type, rating")
        .limit(limit);
      if (error) return NextResponse.json({ error, reqId }, { status: 400 });
      drivers = data ?? [];
    }

    return NextResponse.json({ drivers, reqId }, { status: 200 });
  } catch (err: any) {
    console.error(JSON.stringify({ evt: "mobility.match.error", reqId, message: err?.message }));
    return NextResponse.json({ error: "internal_error", reqId }, { status: 500 });
  }
}

