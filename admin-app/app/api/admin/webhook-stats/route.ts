import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "24h";

  let hoursBack = 24;
  if (period === "7d") hoursBack = 168;
  if (period === "30d") hoursBack = 720;

  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  // Get aggregated stats
  const { data: stats } = await supabase
    .from("webhook_stats")
    .select("*")
    .gte("period_start", since)
    .order("period_start", { ascending: false });

  // Calculate totals
  const totals = (stats || []).reduce(
    (acc, s) => ({
      received: acc.received + (s.received || 0),
      processed: acc.processed + (s.processed || 0),
      failed: acc.failed + (s.failed || 0),
      duplicates_blocked: acc.duplicates_blocked + (s.duplicates_blocked || 0),
      replay_attacks_blocked: acc.replay_attacks_blocked + (s.replay_attacks_blocked || 0),
      total_latency: acc.total_latency + (s.avg_latency_ms || 0),
      count: acc.count + 1,
    }),
    { received: 0, processed: 0, failed: 0, duplicates_blocked: 0, replay_attacks_blocked: 0, total_latency: 0, count: 0 }
  );

  // Get recent errors from security audit log
  const { data: errors } = await supabase
    .from("security_audit_log")
    .select("*")
    .in("event_type", ["SIGNATURE_MISMATCH", "REPLAY_ATTACK_BLOCKED", "RATE_LIMITED"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  const errorBreakdown = {
    signature_mismatch: errors?.filter((e) => e.event_type === "SIGNATURE_MISMATCH").length || 0,
    replay_blocked: errors?.filter((e) => e.event_type === "REPLAY_ATTACK_BLOCKED").length || 0,
    rate_limited: errors?.filter((e) => e.event_type === "RATE_LIMITED").length || 0,
  };

  return NextResponse.json({
    period,
    received: totals.received,
    processed: totals.processed,
    failed: totals.failed,
    duplicates_blocked: totals.duplicates_blocked,
    replay_attacks_blocked: totals.replay_attacks_blocked,
    avg_latency_ms: totals.count > 0 ? Math.round(totals.total_latency / totals.count) : 0,
    error_breakdown: errorBreakdown,
  });
}
