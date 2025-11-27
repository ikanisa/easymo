/**
 * AI Agent Configuration Management API
 * 
 * Endpoints for managing agent personas, instructions, tools, and metrics
 */

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai-agents - List all AI agents with their configurations
 */
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // Get all active agents
    const { data: agents, error } = await supabase
      .from("ai_agents")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    // Get counts for each agent
    const agentsWithCounts = await Promise.all(
      (agents || []).map(async (agent) => {
        const [toolsCount, tasksCount, kbCount, personasCount, instructionsCount] = await Promise.all([
          supabase
            .from("ai_agent_tools")
            .select("id", { count: "exact", head: true })
            .eq("agent_id", agent.id)
            .eq("is_active", true),
          supabase
            .from("ai_agent_tasks")
            .select("id", { count: "exact", head: true })
            .eq("agent_id", agent.id),
          supabase
            .from("ai_agent_knowledge_bases")
            .select("id", { count: "exact", head: true })
            .eq("agent_id", agent.id),
          supabase
            .from("ai_agent_personas")
            .select("id", { count: "exact", head: true })
            .eq("agent_id", agent.id),
          supabase
            .from("ai_agent_system_instructions")
            .select("id", { count: "exact", head: true })
            .eq("agent_id", agent.id),
        ]);

        return {
          ...agent,
          stats: {
            toolsCount: toolsCount.count || 0,
            tasksCount: tasksCount.count || 0,
            kbCount: kbCount.count || 0,
            personasCount: personasCount.count || 0,
            instructionsCount: instructionsCount.count || 0,
          },
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: agentsWithCounts,
    });
  } catch (error: any) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
