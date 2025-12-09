import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "edge";

const querySchema = z.object({
  sacco_id: z.string().uuid(),
  days: z.coerce.number().min(1).max(365).optional().default(30),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = querySchema.parse(searchParams);

    const supabase = await createClient();

    const { data: paymentStats, error: paymentError } = await supabase
      .rpc("get_payment_stats", {
        p_sacco_id: params.sacco_id,
        p_days: params.days,
      });

    if (paymentError) {
      console.error("Payment stats error:", paymentError);
    }

    const { count: memberCount } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("sacco_id", params.sacco_id)
      .eq("status", "ACTIVE");

    const { count: groupCount } = await supabase
      .from("ikimina")
      .select("*", { count: "exact", head: true })
      .eq("sacco_id", params.sacco_id)
      .eq("status", "ACTIVE");

    const { data: savingsData } = await supabase
      .from("accounts")
      .select("balance")
      .eq("sacco_id", params.sacco_id)
      .eq("status", "ACTIVE");

    const totalSavings = (savingsData || []).reduce(
      (sum, acc) => sum + (acc.balance || 0),
      0
    );

    const stats = paymentStats?.[0] || {};

    return NextResponse.json({
      data: {
        members: { total: memberCount || 0 },
        groups: { total: groupCount || 0 },
        payments: {
          total: stats.total_payments || 0,
          total_amount: stats.total_amount || 0,
          matched: stats.matched_count || 0,
          unmatched: stats.unmatched_count || 0,
          today_count: stats.today_payments || 0,
          today_amount: stats.today_amount || 0,
          match_rate: stats.match_rate || 0,
        },
        savings: { total: totalSavings, currency: "RWF" },
      },
      period_days: params.days,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Stats API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
