import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createGroupSchema, groupListQuerySchema } from "@/lib/validations/group";

export const runtime = "edge";

/**
 * GET /api/groups
 * List groups with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = groupListQuerySchema.parse(searchParams);

    const supabase = await createClient();

    let query = supabase
      .from("ikimina")
      .select("*", { count: "exact" })
      .eq("sacco_id", params.sacco_id);

    // Apply filters
    if (params.status !== "all") {
      query = query.eq("status", params.status);
    }

    if (params.type !== "all") {
      query = query.eq("type", params.type);
    }

    if (params.search) {
      query = query.or(
        `name.ilike.%${params.search}%,code.ilike.%${params.search}%`
      );
    }

    // Apply sorting and pagination
    query = query
      .order(params.sort_by, { ascending: params.sort_order === "asc" })
      .range(params.offset, params.offset + params.limit - 1);

    const { data: groups, error, count } = await query;

    if (error) {
      console.error("Groups query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch groups", details: error.message },
        { status: 500 }
      );
    }

    // Get member counts for each group
    const groupsWithStats = await Promise.all(
      (groups || []).map(async (group: Record<string, unknown>) => {
        const { count: memberCount } = await supabase
          .from("members")
          .select("*", { count: "exact", head: true })
          .eq("ikimina_id", group.id)
          .eq("status", "ACTIVE");

        const { data: accounts } = await supabase
          .from("accounts")
          .select("balance")
          .eq("ikimina_id", group.id)
          .eq("status", "ACTIVE");

        const totalSavings = (accounts || []).reduce(
          (sum, acc) => sum + (acc.balance || 0),
          0
        );

        return {
          ...group,
          member_count: memberCount || 0,
          active_members: memberCount || 0,
          total_savings: totalSavings,
        };
      })
    );

    return NextResponse.json({
      data: groupsWithStats,
      pagination: {
        total: count || 0,
        limit: params.limit,
        offset: params.offset,
        has_more: (params.offset + (groups?.length || 0)) < (count || 0),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Groups API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/groups
 * Create a new group
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createGroupSchema.parse(body);

    const supabase = await createClient();

    // Generate group code
    const codePrefix = input.type.substring(0, 3);
    const { count } = await supabase
      .from("ikimina")
      .select("*", { count: "exact", head: true })
      .eq("sacco_id", input.sacco_id);

    const groupCode = `${codePrefix}-${String((count || 0) + 1).padStart(4, "0")}`;

    // Create group
    const { data, error } = await supabase
      .from("ikimina")
      .insert({
        sacco_id: input.sacco_id,
        name: input.name,
        code: groupCode,
        type: input.type,
        description: input.description || null,
        meeting_frequency: input.meeting_frequency,
        meeting_day: input.meeting_day || null,
        contribution_amount: input.contribution_amount || null,
        currency: input.currency || "RWF",
        start_date: input.start_date || null,
        status: "ACTIVE",
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Create group error:", error);
      return NextResponse.json(
        { error: "Failed to create group", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
        message: `Group ${groupCode} created successfully`,
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

    console.error("Create group API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
