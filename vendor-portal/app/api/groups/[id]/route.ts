import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { updateGroupSchema } from "@/lib/validations/group";

export const runtime = "edge";

/**
 * GET /api/groups/[id]
 * Get group details with statistics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Get group details
    const { data: group, error: groupError } = await supabase
      .from("ikimina")
      .select("*")
      .eq("id", params.id)
      .single();

    if (groupError) {
      if (groupError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Group not found" },
          { status: 404 }
        );
      }
      throw groupError;
    }

    // Get group statistics
    const { data: stats, error: statsError } = await supabase
      .rpc("get_group_member_stats", { p_ikimina_id: params.id });

    if (statsError) {
      console.error("Get group stats error:", statsError);
    }

    // Get recent members
    const { data: members } = await supabase
      .from("members")
      .select(
        `
        id,
        member_code,
        full_name,
        status,
        accounts:accounts!accounts_member_id_fkey (
          balance
        )
      `
      )
      .eq("ikimina_id", params.id)
      .order("joined_at", { ascending: false })
      .limit(10);

    interface MemberWithAccounts {
      id: string;
      member_code: string;
      full_name: string;
      status: string;
      accounts?: Array<{ balance?: number }>;
    }
    
    const membersWithBalance = (members || []).map((m: MemberWithAccounts) => ({
      id: m.id,
      member_code: m.member_code,
      full_name: m.full_name,
      status: m.status,
      balance: (m.accounts || []).reduce((sum: number, acc: { balance?: number }) => sum + (acc.balance || 0), 0),
    }));

    return NextResponse.json({
      group,
      stats: stats?.[0] || null,
      members: membersWithBalance,
    });
  } catch (error) {
    console.error("Get group error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/groups/[id]
 * Update group details
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const input = updateGroupSchema.parse(body);

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ikimina")
      .update({
        name: input.name,
        type: input.type,
        description: input.description,
        meeting_frequency: input.meeting_frequency,
        meeting_day: input.meeting_day,
        contribution_amount: input.contribution_amount,
        status: input.status,
        end_date: input.end_date,
        metadata: input.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("Update group error:", error);

      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Group not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "Failed to update group", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: "Group updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Update group API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/groups/[id]
 * Delete/dissolve group (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Check if group has members
    const { count } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("ikimina_id", params.id)
      .eq("status", "ACTIVE");

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete group with ${count} active members` },
        { status: 400 }
      );
    }

    // Soft delete by setting status to DISSOLVED
    const { error } = await supabase
      .from("ikimina")
      .update({
        status: "DISSOLVED",
        end_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (error) {
      console.error("Delete group error:", error);

      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Group not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "Failed to delete group", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Group dissolved successfully",
    });
  } catch (error) {
    console.error("Delete group API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
