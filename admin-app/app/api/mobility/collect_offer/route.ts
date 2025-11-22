import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  const idem = req.headers.get("Idempotency-Key") || undefined;
  const { ride_id, driver_id, eta_minutes, offer_price, note } = await req
    .json();
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable", reqId }, {
      status: 503,
    });
  }
  const { data, error } = await supabase
    .from("ride_candidates")
    .insert([{
      ride_id,
      driver_id,
      eta_minutes,
      offer_price,
      driver_message: note,
    }])
    .select();
  if (error) return NextResponse.json({ error, reqId }, { status: 400 });
  return NextResponse.json({
    candidate: data?.[0],
    reqId,
    idempotencyKey: idem,
  }, { status: 201 });
}

export const runtime = "nodejs";
