/**
 * Persona Management API
 */

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * PUT /api/ai-agents/[id]/persona - Update agent persona
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const body = await request.json();
    const { personaId, updates } = body;

    const { data, error } = await supabase
      .from("ai_agent_personas")
      .update(updates)
      .eq("id", personaId)
      .eq("agent_id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("Error updating persona:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
