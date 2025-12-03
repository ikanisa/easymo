import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("per_page") || "20");
  const status = searchParams.get("status");
  const provider = searchParams.get("provider");
  const merchantId = searchParams.get("merchant_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const clientTxnId = searchParams.get("client_transaction_id");

  let query = supabase
    .from("momo_transactions")
    .select("*", { count: "exact" });

  if (status) query = query.eq("status", status);
  if (provider) query = query.eq("provider", provider);
  if (merchantId) query = query.eq("merchant_id", merchantId);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);
  if (clientTxnId) query = query.eq("client_transaction_id", clientTxnId);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    transactions: data,
    total: count || 0,
    page,
    per_page: perPage,
  });
}
