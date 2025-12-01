import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const listParamsSchema = z.object({
  vendorId: z.string().uuid(),
  period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

interface ReportPeriod {
  period: string;
  startDate: string;
  endDate: string;
  transactionCount: number;
  totalRevenue: number;
  uniquePayers: number;
  topPayers: Array<{
    payerPhone: string;
    payerName: string | null;
    totalPaid: number;
  }>;
}

function getDateRange(period: "daily" | "weekly" | "monthly", date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  const end = new Date(date);
  
  if (period === "daily") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "weekly") {
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
  }
  
  return { start, end };
}

function formatPeriodLabel(period: "daily" | "weekly" | "monthly", date: Date): string {
  if (period === "daily") {
    return date.toISOString().split("T")[0];
  } else if (period === "weekly") {
    const { start, end } = getDateRange(period, date);
    return `${start.toISOString().split("T")[0]} - ${end.toISOString().split("T")[0]}`;
  } else {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
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

  const { vendorId, period } = parsed.data;
  
  // Default to last 30 days for daily, 12 weeks for weekly, 12 months for monthly
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : new Date();
  const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : (() => {
    const d = new Date(endDate);
    if (period === "daily") {
      d.setDate(d.getDate() - 30);
    } else if (period === "weekly") {
      d.setDate(d.getDate() - 84);
    } else {
      d.setMonth(d.getMonth() - 12);
    }
    return d;
  })();

  // Get all transactions in the date range
  const { data: transactions, error: txnError } = await admin
    .from("vendor_sms_transactions")
    .select("amount, payer_phone, payer_name, created_at")
    .eq("vendor_id", vendorId)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: true });

  if (txnError) {
    return NextResponse.json({ error: txnError.message }, { status: 500 });
  }

  // Group transactions by period
  const periodMap = new Map<string, {
    transactions: Array<{ amount: number | null; payerPhone: string | null; payerName: string | null }>;
    start: Date;
    end: Date;
  }>();

  for (const txn of transactions ?? []) {
    const txnDate = new Date(txn.created_at);
    const { start, end } = getDateRange(period, txnDate);
    const periodLabel = formatPeriodLabel(period, txnDate);
    
    if (!periodMap.has(periodLabel)) {
      periodMap.set(periodLabel, { transactions: [], start, end });
    }
    
    periodMap.get(periodLabel)!.transactions.push({
      amount: txn.amount !== null ? Number(txn.amount) : null,
      payerPhone: txn.payer_phone,
      payerName: txn.payer_name,
    });
  }

  // Build report data
  const reports: ReportPeriod[] = [];
  
  for (const [periodLabel, data] of periodMap.entries()) {
    const transactionCount = data.transactions.length;
    const totalRevenue = data.transactions.reduce((sum, t) => sum + (t.amount ?? 0), 0);
    
    // Count unique payers
    const uniquePayerSet = new Set(data.transactions.map(t => t.payerPhone).filter(Boolean));
    const uniquePayers = uniquePayerSet.size;
    
    // Calculate top payers
    const payerTotals = new Map<string, { name: string | null; total: number }>();
    for (const txn of data.transactions) {
      if (txn.payerPhone) {
        const existing = payerTotals.get(txn.payerPhone) ?? { name: txn.payerName, total: 0 };
        existing.total += txn.amount ?? 0;
        if (txn.payerName) existing.name = txn.payerName;
        payerTotals.set(txn.payerPhone, existing);
      }
    }
    
    const topPayers = Array.from(payerTotals.entries())
      .map(([phone, data]) => ({
        payerPhone: phone,
        payerName: data.name,
        totalPaid: data.total,
      }))
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .slice(0, 5);
    
    reports.push({
      period: periodLabel,
      startDate: data.start.toISOString(),
      endDate: data.end.toISOString(),
      transactionCount,
      totalRevenue,
      uniquePayers,
      topPayers,
    });
  }
  
  // Sort reports by date descending
  reports.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return NextResponse.json({ data: reports });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
