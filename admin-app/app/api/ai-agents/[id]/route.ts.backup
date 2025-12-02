/**
 * Individual AI Agent Management API
 */

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai-agents/[id] - Get agent details with full configuration
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // Get agent with all related data
    const [agentData, personasData, instructionsData, toolsData, tasksData, kbData] =
      await Promise.all([
        supabase.from("ai_agents").select("*").eq("id", params.id).single(),
        supabase
          .from("ai_agent_personas")
          .select("*")
          .eq("agent_id", params.id)
          .order("is_default", { ascending: false }),
        supabase
          .from("ai_agent_system_instructions")
          .select("*")
          .eq("agent_id", params.id)
          .order("is_active", { ascending: false }),
        supabase
          .from("ai_agent_tools")
          .select("*")
          .eq("agent_id", params.id)
          .order("name"),
        supabase
          .from("ai_agent_tasks")
          .select("*")
          .eq("agent_id", params.id)
          .order("name"),
        supabase
          .from("ai_agent_knowledge_bases")
          .select("*")
          .eq("agent_id", params.id)
          .order("name"),
      ]);

    if (agentData.error) throw agentData.error;

    const agent = {
      ...agentData.data,
      personas: personasData.data || [],
      instructions: instructionsData.data || [],
      tools: toolsData.data || [],
      tasks: tasksData.data || [],
      knowledge_bases: kbData.data || [],
    };

    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error: any) {
    console.error("Error fetching agent:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
