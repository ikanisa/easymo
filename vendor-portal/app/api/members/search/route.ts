import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "edge";

const querySchema = z.object({
  sacco_id: z.string().uuid(),
  q: z.string().min(1),
  ikimina_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
});

/**
 * GET /api/members/search
 * Fast member search by name, code, or phone
 * Optimized for autocomplete/typeahead
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = querySchema.parse(searchParams);

    const supabase = await createClient();

    // Build search query
    let query = supabase
      .from("members")
      .select(
        `
        id,
        member_code,
        full_name,
        msisdn_masked,
        status,
        ikimina:ikimina!members_ikimina_id_fkey (
          id,
          name,
          code
        ),
        accounts:accounts!accounts_member_id_fkey (
          id,
          account_type,
          balance,
          currency
        )
      `
      )
      .eq("sacco_id", params.sacco_id)
      .eq("status", "ACTIVE");

    // Apply group filter if provided
    if (params.ikimina_id) {
      query = query.eq("ikimina_id", params.ikimina_id);
    }

    // Search across multiple fields
    query = query.or(
      `full_name.ilike.%${params.q}%,member_code.ilike.%${params.q}%,msisdn_masked.ilike.%${params.q}%`
    );

    // Limit results and order by relevance
    query = query
      .order("full_name", { ascending: true })
      .limit(params.limit);

    const { data, error } = await query;

    if (error) {
      console.error("Member search error:", error);
      return NextResponse.json(
        { error: "Search failed" },
        { status: 500 }
      );
    }

    // Transform results with computed balance
    const results = (data || []).map((member: any) => {
      const totalBalance = (member.accounts || []).reduce(
        (sum: number, acc: any) => sum + (acc.balance || 0),
        0
      );

      return {
        id: member.id,
        member_code: member.member_code,
        full_name: member.full_name,
        msisdn_masked: member.msisdn_masked,
        status: member.status,
        ikimina: member.ikimina,
        total_balance: totalBalance,
        accounts: member.accounts,
      };
    });

    return NextResponse.json({
      data: results,
      query: params.q,
      count: results.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
