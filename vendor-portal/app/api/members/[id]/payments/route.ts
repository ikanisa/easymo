import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

/**
 * GET /api/members/[id]/payments
 * Get member's payment history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = querySchema.parse(searchParams);

    const supabase = await createClient();

    // Call the get_member_payment_history function
    const { data, error } = await supabase.rpc("get_member_payment_history", {
      p_member_id: params.id,
      p_limit: query.limit,
      p_offset: query.offset,
    });

    if (error) {
      console.error("Get payment history error:", error);
      return NextResponse.json(
        { error: "Failed to fetch payment history" },
        { status: 500 }
      );
    }

    // Get total count for pagination
    const { count } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("member_id", params.id);

    return NextResponse.json({
      data: data || [],
      pagination: {
        total: count || 0,
        limit: query.limit,
        offset: query.offset,
        has_more: (query.offset + (data?.length || 0)) < (count || 0),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Payment history API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
