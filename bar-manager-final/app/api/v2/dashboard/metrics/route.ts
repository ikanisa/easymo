import { NextResponse } from "next/server";

import { createAdminClient } from "@/src/v2/lib/supabase/client";
import { handleAPIError, jsonOk } from "@/lib/api/error-handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { normalizeNumber } from "../../_lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const limiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 500 });
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    await limiter.check(20, ip); // 20 requests per minute

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

    return jsonOk({
      totalAgents: agentsResult.count ?? 0,
      totalDrivers: driversResult.count ?? 0,
      totalStations: stationsResult.count ?? 0,
      monthlyRevenue,
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
