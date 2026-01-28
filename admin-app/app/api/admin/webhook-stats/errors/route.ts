import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("per_page") || "50");
  const eventType = searchParams.get("event_type");

  let query = supabase
    .from("security_audit_log")
    .select("*", { count: "exact" })
    .in("event_type", ["SIGNATURE_MISMATCH", "REPLAY_ATTACK_BLOCKED", "RATE_LIMITED", "INVALID_PAYLOAD"]);

  if (eventType) query = query.eq("event_type", eventType);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    errors: data?.map((e) => ({
      timestamp: e.created_at,
      error_type: e.event_type,
      device_id: e.device_id,
      details: JSON.stringify(e.details),
      request_id: e.details?.correlationId,
    })),
    total: count || 0,
    page,
    per_page: perPage,
  });
}
