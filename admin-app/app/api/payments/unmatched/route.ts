import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const listParamsSchema = z.object({
  saccoId: z.string().uuid(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().min(1).optional(),
});

const manualMatchSchema = z.object({
  smsInboxId: z.string().uuid(),
  memberId: z.string().uuid(),
  saccoId: z.string().uuid(),
});

function mapSmsInboxRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    saccoId: row.sacco_id as string,
    rawMessage: row.raw_message as string,
    senderPhone: row.sender_phone as string,
    senderName: (row.sender_name as string | null) ?? null,
    amount: row.amount !== null && row.amount !== undefined ? Number(row.amount) : null,
    transactionId: (row.transaction_id as string | null) ?? null,
    provider: (row.provider as string | null) ?? null,
    matchedMemberId: (row.matched_member_id as string | null) ?? null,
    matchConfidence: row.match_confidence !== null && row.match_confidence !== undefined ? Number(row.match_confidence) : null,
    matchMethod: (row.match_method as string | null) ?? null,
    status: row.status as string,
    receivedAt: row.received_at as string,
    processedAt: (row.processed_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listParamsSchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params", issues: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const { saccoId, limit, offset, startDate, endDate, search } = parsed.data;
  
  // Query unmatched SMS
  let query = admin
    .schema('app')
    .from("sms_inbox")
    .select("*", { count: "exact" })
    .eq("sacco_id", saccoId)
    .in("status", ["pending", "unmatched"])
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (startDate) {
    query = query.gte("received_at", startDate);
  }

  if (endDate) {
    query = query.lte("received_at", endDate);
  }

  if (search) {
    query = query.or(`sender_phone.ilike.%${search}%,sender_name.ilike.%${search}%,transaction_id.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map(mapSmsInboxRow);
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return NextResponse.json({ data: rows, total, hasMore });
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = manualMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params", issues: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const { smsInboxId, memberId, saccoId } = parsed.data;

  // Verify SMS belongs to SACCO
  const { data: sms, error: smsError } = await admin
    .schema('app')
    .from("sms_inbox")
    .select("*")
    .eq("id", smsInboxId)
    .eq("sacco_id", saccoId)
    .single();

  if (smsError || !sms) {
    return NextResponse.json({ error: "sms_not_found" }, { status: 404 });
  }

  // Verify member belongs to SACCO
  const { data: member, error: memberError } = await admin
    .schema('app')
    .from("members")
    .select("*")
    .eq("id", memberId)
    .eq("sacco_id", saccoId)
    .single();

  if (memberError || !member) {
    return NextResponse.json({ error: "member_not_found" }, { status: 404 });
  }

  // Update SMS with manual match
  const { error: updateError } = await admin
    .schema('app')
    .from("sms_inbox")
    .update({
      matched_member_id: memberId,
      match_confidence: 1.0,
      match_method: "manual",
      status: "matched",
      processed_at: new Date().toISOString(),
    })
    .eq("id", smsInboxId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Process payment using the database function
  if (sms.amount && sms.amount > 0) {
    const { data: paymentId, error: paymentError } = await admin.rpc(
      "app.process_sacco_payment",
      {
        p_sacco_id: saccoId,
        p_member_id: memberId,
        p_amount: sms.amount,
        p_reference: `Manual match: MoMo payment from ${sms.sender_name || sms.sender_phone}`,
        p_transaction_id: sms.transaction_id,
        p_provider: sms.provider,
        p_sms_inbox_id: smsInboxId,
        p_account_type: "savings",
      }
    );

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      smsInboxId,
      paymentId,
      message: "SMS matched and payment processed" 
    });
  }

  return NextResponse.json({ 
    success: true, 
    smsInboxId,
    message: "SMS matched but no payment processed (invalid amount)" 
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
