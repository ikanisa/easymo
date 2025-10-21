import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { driver_phone_e164, lat, lng, available = true } = await req.json();
  const { data: driver } = await supabase.from("drivers").select("id").eq("phone_e164", driver_phone_e164).single();
  if (!driver) return NextResponse.json({ error: "driver_not_found", reqId }, { status: 404 });
  await supabase.from("driver_availability").insert({
    driver_id: (driver as any).id,
    available,
    loc: `SRID=4326;POINT(${lng} ${lat})`
  });
  return NextResponse.json({ ok: true, reqId }, { status: 201 });
}

