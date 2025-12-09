import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { updateMemberSchema } from "@/lib/validations/member";

export const runtime = "edge";

/**
 * GET /api/members/[id]
 * Get member details with summary stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Get member summary (includes stats)
    const { data: summary, error: summaryError } = await supabase
      .rpc("get_member_summary", { p_member_id: params.id });

    if (summaryError) {
      if (summaryError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Member not found" },
          { status: 404 }
        );
      }
      throw summaryError;
    }

    if (!summary || summary.length === 0) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Get full member data with relations
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select(
        `
        *,
        ikimina:ikimina!members_ikimina_id_fkey (
          id,
          name,
          code,
          type,
          meeting_frequency,
          contribution_amount
        ),
        accounts:accounts!accounts_member_id_fkey (
          id,
          account_type,
          balance,
          currency,
          status
        )
      `
      )
      .eq("id", params.id)
      .single();

    if (memberError) {
      throw memberError;
    }

    return NextResponse.json({
      member: summary[0],
      details: member,
    });
  } catch (error) {
    console.error("Get member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/members/[id]
 * Update member details
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const input = updateMemberSchema.parse(body);

    const supabase = await createClient();

    // Call the update_member function
    const { data, error } = await supabase.rpc("update_member", {
      p_member_id: params.id,
      p_full_name: input.full_name || null,
      p_phone: input.phone || null,
      p_national_id: input.national_id || null,
      p_email: input.email || null,
      p_gender: input.gender || null,
      p_date_of_birth: input.date_of_birth || null,
      p_address: input.address || null,
      p_ikimina_id: input.ikimina_id || null,
      p_status: input.status || null,
      p_metadata: input.metadata || null,
    });

    if (error) {
      console.error("Update member error:", error);

      if (error.message.includes("already exists")) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        );
      }

      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: "Member not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "Failed to update member", details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data[0],
      message: "Member updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Update member API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/members/[id]
 * Deactivate member (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = request.nextUrl;
    const reason = searchParams.get("reason") || undefined;

    const supabase = await createClient();

    // Call the deactivate_member function
    const { error } = await supabase.rpc("deactivate_member", {
      p_member_id: params.id,
      p_reason: reason,
    });

    if (error) {
      console.error("Deactivate member error:", error);

      if (error.message.includes("outstanding balance")) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: "Member not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "Failed to deactivate member", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Member deactivated successfully",
    });
  } catch (error) {
    console.error("Delete member API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
