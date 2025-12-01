import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const listParamsSchema = z.object({
  vendorId: z.string().uuid(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().min(1).optional(),
});

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    vendorId: row.vendor_id as string,
    payerPhone: row.payer_phone as string,
    payerName: (row.payer_name as string | null) ?? null,
    totalPaid: Number(row.total_paid) || 0,
    currency: (row.currency as string) ?? "RWF",
    paymentCount: Number(row.payment_count) || 0,
    firstPaymentAt: (row.first_payment_at as string | null) ?? null,
    lastPaymentAt: (row.last_payment_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
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

  const { vendorId, limit, offset, search } = parsed.data;
  
  let query = admin
    .from("vendor_payer_ledgers")
    .select("*", { count: "exact" })
    .eq("vendor_id", vendorId)
    .order("total_paid", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`payer_name.ilike.%${search}%,payer_phone.ilike.%${search}%`);
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
