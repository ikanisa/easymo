import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  // Verify vendor exists
  const { data: vendor, error: vendorError } = await admin
    .from("sms_parsing_vendors")
    .select("id")
    .eq("id", id)
    .single();

  if (vendorError || !vendor) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Get total transactions and revenue
  const { data: totalStats, error: totalError } = await admin
    .from("vendor_sms_transactions")
    .select("amount")
    .eq("vendor_id", id);

  if (totalError) {
    return NextResponse.json({ error: totalError.message }, { status: 500 });
  }

  const totalTransactions = totalStats?.length ?? 0;
  const totalRevenue = (totalStats ?? []).reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0);

  // Get unique payers count
  const { count: uniquePayers, error: payersError } = await admin
    .from("vendor_payer_ledgers")
    .select("*", { count: "exact", head: true })
    .eq("vendor_id", id);

  if (payersError) {
    return NextResponse.json({ error: payersError.message }, { status: 500 });
  }

  // Get this month's transactions
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: monthStats, error: monthError } = await admin
    .from("vendor_sms_transactions")
    .select("amount")
    .eq("vendor_id", id)
    .gte("created_at", startOfMonth.toISOString());

  if (monthError) {
    return NextResponse.json({ error: monthError.message }, { status: 500 });
  }

  const thisMonthTransactions = monthStats?.length ?? 0;
  const thisMonthRevenue = (monthStats ?? []).reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0);

  // Get parser breakdown
  const { data: parserStats, error: parserError } = await admin
    .from("vendor_sms_transactions")
    .select("parsed_by")
    .eq("vendor_id", id);

  if (parserError) {
    return NextResponse.json({ error: parserError.message }, { status: 500 });
  }

  const parserBreakdown = {
    openai: (parserStats ?? []).filter(t => t.parsed_by === "openai").length,
    gemini: (parserStats ?? []).filter(t => t.parsed_by === "gemini").length,
    regex: (parserStats ?? []).filter(t => t.parsed_by === "regex").length,
  };

  return NextResponse.json({
    data: {
      totalTransactions,
      totalRevenue,
      uniquePayers: uniquePayers ?? 0,
      thisMonthTransactions,
      thisMonthRevenue,
      parserBreakdown,
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
