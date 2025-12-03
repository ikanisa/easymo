import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: txn, error } = await supabase
    .from("momo_transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !txn) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Build timeline
  const timeline = [
    { timestamp: txn.received_at, event: "SMS_RECEIVED", details: { device_id: txn.device_id, provider: txn.provider } },
  ];

  if (txn.processed_at) {
    timeline.push({ timestamp: txn.processed_at, event: "PROCESSED", details: { status: txn.status } });
  }

  if (txn.matched_record_id) {
    timeline.push({
      timestamp: txn.processed_at,
      event: "MATCHED",
      details: { table: txn.matched_table, record_id: txn.matched_record_id, confidence: txn.match_confidence },
    });
  }

  // Get security events for this correlation
  const { data: securityEvents } = await supabase
    .from("security_audit_log")
    .select("*")
    .eq("details->>correlationId", txn.correlation_id)
    .order("created_at", { ascending: true });

  if (securityEvents) {
    securityEvents.forEach((evt) => {
      timeline.push({ timestamp: evt.created_at, event: evt.event_type, details: evt.details });
    });
  }

  // Sort timeline
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return NextResponse.json({
    client_transaction_id: txn.client_transaction_id,
    server_transaction_id: txn.id,
    timeline,
    matched_record: txn.matched_record_id
      ? { table: txn.matched_table, id: txn.matched_record_id, type: txn.service_type }
      : null,
  });
}
