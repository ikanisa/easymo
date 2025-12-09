import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { createMemberSchema, memberListQuerySchema } from "@/lib/validations/member";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = memberListQuerySchema.parse(searchParams);

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
      .order(params.sort_by, { ascending: params.sort_order === "asc" })
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

/**
 * POST /api/members
 * Create a new member
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createMemberSchema.parse(body);

    const supabase = await createClient();

    // Call the create_member function
    const { data, error } = await supabase.rpc("create_member", {
      p_sacco_id: input.sacco_id,
      p_ikimina_id: input.ikimina_id,
      p_full_name: input.full_name,
      p_phone: input.phone,
      p_national_id: input.national_id || null,
      p_email: input.email || null,
      p_gender: input.gender || null,
      p_date_of_birth: input.date_of_birth || null,
      p_address: input.address || null,
      p_metadata: input.metadata || {},
    });

    if (error) {
      console.error("Create member error:", error);

      // Handle specific errors
      if (error.message.includes("already exists")) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create member", details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Member creation returned no result" },
        { status: 500 }
      );
    }

    const result = data[0];

    // Fetch the created member with relations
    const { data: member, error: fetchError } = await supabase
      .from("members")
      .select(
        `
        *,
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
      .eq("id", result.member_id)
      .single();

    if (fetchError) {
      console.error("Fetch created member error:", fetchError);
    }

    return NextResponse.json(
      {
        success: true,
        data: member || {
          member_id: result.member_id,
          member_code: result.member_code,
          account_id: result.account_id,
        },
        message: `Member ${result.member_code} created successfully`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Create member API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
