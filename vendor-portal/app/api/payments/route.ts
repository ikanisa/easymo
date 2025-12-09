import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

// Query params schema
const querySchema = z.object({
  sacco_id: z.string().uuid(),
  status: z.enum(["matched", "pending", "failed", "all"]).optional().default("all"),
  member_id: z.string().uuid().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  sort_by: z.enum(["created_at", "amount", "status"]).optional().default("created_at"),
  sort_order: z.enum(["asc", "desc"]).optional().default("desc"),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = querySchema.parse(searchParams);

    const supabase = await createClient();

    // Build query
    let query = supabase
      .from("payments")
      .select(
        `
        id,
        amount,
        currency,
        payment_method,
        reference,
        status,
        confidence,
        created_at,
        processed_at,
        metadata,
        member:members!payments_member_id_fkey (
          id,
          full_name,
          member_code,
          msisdn_masked
        ),
        ikimina:ikimina!payments_ikimina_id_fkey (
          id,
          name,
          code
        )
      `,
        { count: "exact" }
      )
      .eq("sacco_id", params.sacco_id);

    // Apply filters
    if (params.status !== "all") {
      query = query.eq("status", params.status);
    }

    if (params.member_id) {
      query = query.eq("member_id", params.member_id);
    }

    if (params.from_date) {
      query = query.gte("created_at", params.from_date);
    }

    if (params.to_date) {
      query = query.lte("created_at", params.to_date);
    }

    // Apply sorting and pagination
    query = query
      .order(params.sort_by, { ascending: params.sort_order === "asc" })
      .range(params.offset, params.offset + params.limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Payments query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch payments", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
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

    console.error("Payments API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
