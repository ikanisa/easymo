import { NextResponse } from "next/server";

import { createAdminClient } from "@/src/v2/lib/supabase/client";

import { handleRouteError, normalizeNumber } from "../../_lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createAdminClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [agentsResult, driversResult, stationsResult, transactionsResult] = await Promise.all([
      supabase.from("agents").select("id", { count: "exact", head: true }),
      supabase.from("drivers").select("id", { count: "exact", head: true }),
      supabase.from("stations").select("id", { count: "exact", head: true }),
      supabase
        .from("transactions")
        .select("amount, created_at")
        .gte("created_at", since),
    ]);

    if (agentsResult.error) throw agentsResult.error;
    if (driversResult.error) throw driversResult.error;
    if (stationsResult.error) throw stationsResult.error;
    if (transactionsResult.error) throw transactionsResult.error;

    const monthlyRevenue = (transactionsResult.data ?? []).reduce((total, transaction) => {
      return total + (normalizeNumber(transaction.amount) ?? 0);
    }, 0);

    return NextResponse.json({
      totalAgents: agentsResult.count ?? 0,
      totalDrivers: driversResult.count ?? 0,
      totalStations: stationsResult.count ?? 0,
      monthlyRevenue,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
