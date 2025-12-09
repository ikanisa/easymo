import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "edge";

const querySchema = z.object({
  sacco_id: z.string().uuid(),
  search: z.string().optional(),
  ikimina_id: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "all"]).optional().default("ACTIVE"),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = querySchema.parse(searchParams);

    const supabase = await createClient();

    let query = supabase
      .from("members")
      .select(
        `
        id,
        member_code,
        full_name,
        msisdn_masked,
        status,
        joined_at,
        created_at,
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
      `,
        { count: "exact" }
      )
      .eq("sacco_id", params.sacco_id);

    if (params.status !== "all") {
      query = query.eq("status", params.status);
    }

    if (params.ikimina_id) {
      query = query.eq("ikimina_id", params.ikimina_id);
    }

    if (params.search) {
      query = query.or(
        `full_name.ilike.%${params.search}%,member_code.ilike.%${params.search}%,msisdn_masked.ilike.%${params.search}%`
      );
    }

    query = query
      .order("full_name", { ascending: true })
      .range(params.offset, params.offset + params.limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Members query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch members" },
        { status: 500 }
      );
    }

    const membersWithBalance = (data || []).map((member: any) => {
      const totalBalance = (member.accounts || []).reduce(
        (sum: number, acc: any) => sum + (acc.balance || 0),
        0
      );
      return { ...member, total_balance: totalBalance };
    });

    return NextResponse.json({
      data: membersWithBalance,
      pagination: {
        total: count || 0,
        limit: params.limit,
        offset: params.offset,
        has_more: (params.offset + (data?.length || 0)) < (count || 0),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Members API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
