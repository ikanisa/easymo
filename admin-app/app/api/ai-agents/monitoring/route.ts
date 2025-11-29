/**
 * Monitoring API - Real-time agent metrics and logs
 */

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai-agents/monitoring - Get system-wide monitoring data
 */
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get("timeRange") || "24h";

  try {
    // Calculate time threshold
    const now = new Date();
    const threshold = new Date();
    switch (timeRange) {
      case "1h":
        threshold.setHours(now.getHours() - 1);
        break;
      case "24h":
        threshold.setHours(now.getHours() - 24);
        break;
      case "7d":
        threshold.setDate(now.getDate() - 7);
        break;
      case "30d":
        threshold.setDate(now.getDate() - 30);
        break;
      default:
        threshold.setHours(now.getHours() - 24);
    }

    // Get active agents count
    const { count: activeAgents } = await supabase
      .from("ai_agents")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    // Get recent tool executions
    const { data: recentExecutions, count: totalExecutions } = await supabase
      .from("ai_agent_tool_executions")
      .select("*", { count: "exact" })
      .gte("created_at", threshold.toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    // Calculate success rate
    const successful = recentExecutions?.filter((e) => e.success).length || 0;
    const failed = recentExecutions?.filter((e) => !e.success).length || 0;
    const successRate = totalExecutions ? (successful / totalExecutions) * 100 : 0;

    // Get average execution time
    const avgExecutionTime =
      recentExecutions && recentExecutions.length > 0
        ? recentExecutions.reduce((sum, e) => sum + e.execution_time_ms, 0) /
          recentExecutions.length
        : 0;

    // Get recent conversations
    const { count: recentConversations } = await supabase
      .from("whatsapp_conversations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", threshold.toISOString());

    // Get tool usage breakdown
    const { data: toolUsage } = await supabase
      .from("ai_agent_tool_executions")
      .select("tool_name, success")
      .gte("created_at", threshold.toISOString());

    // Aggregate tool usage
    const toolStats = (toolUsage || []).reduce((acc: any, execution) => {
      const tool = execution.tool_name;
      if (!acc[tool]) {
        acc[tool] = { total: 0, successful: 0, failed: 0 };
      }
      acc[tool].total++;
      if (execution.success) {
        acc[tool].successful++;
      } else {
        acc[tool].failed++;
      }
      return acc;
    }, {});

    // Get error logs (most recent failures)
    const { data: errorLogs } = await supabase
      .from("ai_agent_tool_executions")
      .select("*")
      .eq("success", false)
      .gte("created_at", threshold.toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    // Get agent-specific metrics
    const { data: agents } = await supabase
      .from("ai_agents")
      .select("id, name, slug")
      .eq("is_active", true);

    const agentMetrics = await Promise.all(
      (agents || []).map(async (agent) => {
        const { count: conversations } = await supabase
          .from("whatsapp_conversations")
          .select("*", { count: "exact", head: true })
          .eq("agent_id", agent.id)
          .gte("created_at", threshold.toISOString());

        const { data: executions } = await supabase
          .from("ai_agent_tool_executions")
          .select("success, execution_time_ms")
          .eq("agent_id", agent.id)
          .gte("created_at", threshold.toISOString());

        const agentSuccessful = executions?.filter((e) => e.success).length || 0;
        const agentFailed = executions?.filter((e) => !e.success).length || 0;
        const agentTotal = executions?.length || 0;

        return {
          ...agent,
          conversations: conversations || 0,
          toolExecutions: agentTotal,
          successRate: agentTotal > 0 ? (agentSuccessful / agentTotal) * 100 : 0,
          avgExecutionTime:
            executions && executions.length > 0
              ? executions.reduce((sum, e) => sum + e.execution_time_ms, 0) /
                executions.length
              : 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          activeAgents: activeAgents || 0,
          totalExecutions: totalExecutions || 0,
          successfulExecutions: successful,
          failedExecutions: failed,
          successRate: Math.round(successRate * 10) / 10,
          avgExecutionTime: Math.round(avgExecutionTime),
          recentConversations: recentConversations || 0,
        },
        toolStats,
        errorLogs: errorLogs || [],
        agentMetrics,
        recentExecutions: recentExecutions?.slice(0, 20) || [],
        timeRange,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error fetching monitoring data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
