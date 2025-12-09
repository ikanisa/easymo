import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

const querySchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "all"]).optional().default("ACTIVE"),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

/**
 * GET /api/groups/[id]/members
 * Get all members in a group
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = querySchema.parse(searchParams);

    const supabase = await createClient();

    let dbQuery = supabase
      .from("members")
      .select(
        `
        id,
        member_code,
        full_name,
        msisdn_masked,
        status,
        joined_at,
        accounts:accounts!accounts_member_id_fkey (
          id,
          account_type,
          balance,
          currency,
          status
        )
      `,
        { count: "exact" }
      )
      .eq("ikimina_id", params.id);

    if (query.status !== "all") {
      dbQuery = dbQuery.eq("status", query.status);
    }

    dbQuery = dbQuery
      .order("full_name", { ascending: true })
      .range(query.offset, query.offset + query.limit - 1);

    const { data, error, count } = await dbQuery;

    if (error) {
      console.error("Get group members error:", error);
      return NextResponse.json(
        { error: "Failed to fetch members" },
        { status: 500 }
      );
    }

    interface Account {
      status?: string;
      balance?: number;
    }
    
    interface MemberWithAccounts {
      accounts?: Account[];
      [key: string]: unknown;
    }
    
    // Calculate total balance for each member
    const membersWithBalance = (data || []).map((member: MemberWithAccounts) => {
      const totalBalance = (member.accounts || [])
        .filter((acc: Account) => acc.status === "ACTIVE")
        .reduce((sum: number, acc: Account) => sum + (acc.balance || 0), 0);
      return {
        ...member,
        total_balance: totalBalance,
      };
    });

    return NextResponse.json({
      data: membersWithBalance,
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

    console.error("Group members API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

}
