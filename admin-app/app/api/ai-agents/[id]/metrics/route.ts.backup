/**
 * Agent Metrics API
 */

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai-agents/[id]/metrics - Get agent usage statistics
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // Get conversation count
    const { count: conversationCount } = await supabase
      .from("whatsapp_conversations")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", params.id);

    // Get tool execution stats
    const { data: toolStats } = await supabase
      .from("ai_agent_tool_executions")
      .select("success, execution_time_ms")
      .eq("agent_id", params.id);

    const toolExecutions = toolStats || [];
    const successfulExecutions = toolExecutions.filter((e) => e.success).length;
    const failedExecutions = toolExecutions.filter((e) => !e.success).length;
    const avgExecutionTime =
      toolExecutions.length > 0
        ? toolExecutions.reduce((sum, e) => sum + e.execution_time_ms, 0) /
          toolExecutions.length
        : 0;

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentConversations } = await supabase
      .from("whatsapp_conversations")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", params.id)
      .gte("created_at", sevenDaysAgo.toISOString());

    return NextResponse.json({
      success: true,
      data: {
        conversations: {
          total: conversationCount || 0,
          lastWeek: recentConversations || 0,
        },
        toolExecutions: {
          total: toolExecutions.length,
          successful: successfulExecutions,
          failed: failedExecutions,
          avgExecutionTime: Math.round(avgExecutionTime),
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
