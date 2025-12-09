import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "edge";

const getQuerySchema = z.object({
  sacco_id: z.string().uuid(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

const matchBodySchema = z.object({
  sms_id: z.string().uuid(),
  member_id: z.string().uuid(),
  sacco_id: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = getQuerySchema.parse(searchParams);

    const supabase = await createClient();

    const { data, error, count } = await supabase
      .from("sms_inbox")
      .select("*", { count: "exact" })
      .eq("sacco_id", params.sacco_id)
      .eq("status", "unmatched")
      .order("received_at", { ascending: false })
      .range(params.offset, params.offset + params.limit - 1);

    if (error) {
      console.error("Unmatched SMS query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch unmatched SMS" },
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

    console.error("Unmatched API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sms_id, member_id } = matchBodySchema.parse(body);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .rpc("manual_match_sms", {
        p_sms_id: sms_id,
        p_member_id: member_id,
        p_matched_by: user?.id || null,
      });

    if (error) {
      console.error("Manual match error:", error);
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: "SMS not found or already matched" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to match payment", details: error.message },
        { status: 500 }
      );
    }

    const result = data[0];
    return NextResponse.json({
      success: true,
      data: {
        payment_id: result.payment_id,
        amount: result.amount,
        member_name: result.member_name,
      },
      message: `Payment of RWF ${result.amount.toLocaleString()} matched to ${result.member_name}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Manual match API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
