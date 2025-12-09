import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "edge";

const querySchema = z.object({
  account_type: z.enum(["savings", "shares", "loan", "welfare"]).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
});

/**
 * GET /api/members/[id]/transactions
 * Get member's ledger transactions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = querySchema.parse(searchParams);

    const supabase = await createClient();

    // Call the get_member_transactions function
    const { data, error } = await supabase.rpc("get_member_transactions", {
      p_member_id: params.id,
      p_account_type: query.account_type || null,
      p_from_date: query.from_date || null,
      p_to_date: query.to_date || null,
      p_limit: query.limit,
      p_offset: query.offset,
    });

    if (error) {
      console.error("Get transactions error:", error);
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        limit: query.limit,
        offset: query.offset,
        has_more: (data?.length || 0) === query.limit,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Transactions API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
