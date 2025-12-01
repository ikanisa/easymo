import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const listParamsSchema = z.object({
  vendorId: z.string().uuid(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().min(1).optional(),
});

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    vendorId: row.vendor_id as string,
    rawSms: row.raw_sms as string,
    senderAddress: (row.sender_address as string | null) ?? null,
    receivedAt: (row.received_at as string | null) ?? null,
    payerName: (row.payer_name as string | null) ?? null,
    payerPhone: (row.payer_phone as string | null) ?? null,
    amount: row.amount !== null && row.amount !== undefined ? Number(row.amount) : null,
    currency: (row.currency as string) ?? "RWF",
    txnId: (row.txn_id as string | null) ?? null,
    txnTimestamp: (row.txn_timestamp as string | null) ?? null,
    provider: (row.provider as string | null) ?? null,
    aiConfidence: row.ai_confidence !== null && row.ai_confidence !== undefined ? Number(row.ai_confidence) : null,
    parsedJson: (row.parsed_json as Record<string, unknown> | null) ?? null,
    status: (row.status as string) ?? "parsed",
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

  const { vendorId, limit, offset, startDate, endDate, search } = parsed.data;
  
  let query = admin
    .from("vendor_sms_transactions")
    .select("*", { count: "exact" })
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (startDate) {
    query = query.gte("created_at", startDate);
  }

  if (endDate) {
    query = query.lte("created_at", endDate);
  }

  if (search) {
    query = query.or(`payer_name.ilike.%${search}%,payer_phone.ilike.%${search}%,txn_id.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map(mapRow);
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return NextResponse.json({ data: rows, total, hasMore });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
