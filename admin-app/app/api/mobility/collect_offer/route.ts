import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  const idem = req.headers.get("Idempotency-Key") || undefined;
  const { ride_id, driver_id, eta_minutes, offer_price, note } = await req.json();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await supabase
    .from("ride_candidates")
    .insert([{ ride_id, driver_id, eta_minutes, offer_price, driver_message: note }])
    .select();
  if (error) return NextResponse.json({ error, reqId }, { status: 400 });
  return NextResponse.json({ candidate: data?.[0], reqId, idempotencyKey: idem }, { status: 201 });
}

