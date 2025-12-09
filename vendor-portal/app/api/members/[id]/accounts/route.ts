import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

/**
 * GET /api/members/[id]/accounts
 * Get member's accounts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("member_id", params.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Get member accounts error:", error);
      return NextResponse.json(
        { error: "Failed to fetch accounts" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Member accounts API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
