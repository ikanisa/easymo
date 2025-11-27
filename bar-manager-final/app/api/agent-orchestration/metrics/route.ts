import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { jsonError,jsonOk } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  agent_type: z.string().optional(),
  days: z.coerce.number().min(1).max(90).default(7),
});

// GET /api/agent-orchestration/metrics - Get agent metrics
export const GET = createHandler("admin_api.agent_metrics.get", async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const params = querySchema.parse(Object.fromEntries(searchParams));

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return jsonError(
        { error: "supabase_unavailable", message: "Supabase admin client is not configured." },
        503,
      );
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - params.days);

    let query = supabase
      .from("agent_metrics")
      .select("*")
      .gte("metric_date", startDate.toISOString().split("T")[0])
      .lte("metric_date", endDate.toISOString().split("T")[0])
      .order("metric_date", { ascending: false });

    if (params.agent_type) {
      query = query.eq("agent_type", params.agent_type);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch agent metrics:", error);
      return jsonError(
        { error: "fetch_failed", message: "Failed to fetch agent metrics" },
        500
      );
    }

    // Calculate aggregate KPIs
    const metrics = data || [];
    const totals = metrics.reduce(
      (acc, m) => {
        acc.total_sessions += m.total_sessions || 0;
        acc.completed_sessions += m.completed_sessions || 0;
        acc.timeout_sessions += m.timeout_sessions || 0;
        acc.cancelled_sessions += m.cancelled_sessions || 0;
        return acc;
      },
      { total_sessions: 0, completed_sessions: 0, timeout_sessions: 0, cancelled_sessions: 0 }
    );

    const timeoutRate = totals.total_sessions > 0
      ? (totals.timeout_sessions / totals.total_sessions) * 100
      : 0;

    const acceptanceRate = totals.total_sessions > 0
      ? (totals.completed_sessions / totals.total_sessions) * 100
      : 0;

    // Get active sessions count
    const { count: activeSessions } = await supabase
      .from("agent_sessions")
      .select("*", { count: "exact", head: true })
      .in("status", ["searching", "negotiating"]);

    return jsonOk({
      metrics: data || [],
      kpis: {
        timeout_rate: timeoutRate.toFixed(1),
        acceptance_rate: acceptanceRate.toFixed(0),
        active_sessions: activeSessions || 0,
        total_sessions: totals.total_sessions,
      },
    });
  } catch (error) {
    console.error("Agent metrics error:", error);
    return jsonError({ error: "internal_error", message: "Internal server error" }, 500);
  }
});

export const runtime = "nodejs";
