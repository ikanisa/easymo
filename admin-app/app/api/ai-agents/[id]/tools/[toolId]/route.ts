/**
 * Tools Management API
 */

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * PUT /api/ai-agents/[id]/tools/[toolId] - Toggle tool active status
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string; toolId: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const body = await request.json();
    const { is_active } = body;

    const { data, error} = await supabase
      .from("ai_agent_tools")
      .update({ is_active })
      .eq("id", params.toolId)
      .eq("agent_id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("Error toggling tool:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
