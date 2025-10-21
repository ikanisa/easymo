import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const idem = req.headers.get("Idempotency-Key") || undefined;
  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { ride_id, driver_id } = await req.json();
    console.log(JSON.stringify({ evt: "mobility.book", reqId, idem, ride_id, driver_id }));

    if (!ride_id || !driver_id) {
      return NextResponse.json({ error: "ride_id and driver_id required", reqId }, { status: 400 });
    }

    const { error } = await supabase.from("rides").update({ status: "booked" }).eq("id", ride_id);
    if (error) return NextResponse.json({ error, reqId }, { status: 400 });

    // TODO: notify driver & passenger via WhatsApp
    return NextResponse.json({ booked: true, ride_id, driver_id, reqId }, { status: 200 });
  } catch (err: any) {
    console.error(JSON.stringify({ evt: "mobility.book.error", reqId, message: err?.message }));
    return NextResponse.json({ error: "internal_error", reqId }, { status: 500 });
  }
}

