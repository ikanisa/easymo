import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { bulkImportSchema } from "@/lib/validations/member";

export const runtime = "edge";

/**
 * POST /api/members/import
 * Bulk import members
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = bulkImportSchema.parse(body);

    const supabase = await createClient();

    // Call the bulk_import_members function
    const { data, error } = await supabase.rpc("bulk_import_members", {
      p_sacco_id: input.sacco_id,
      p_members: input.members,
    });

    if (error) {
      console.error("Bulk import error:", error);
      return NextResponse.json(
        { error: "Failed to import members", details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Import returned no result" },
        { status: 500 }
      );
    }

    const result = data[0];

    return NextResponse.json({
      success: true,
      total_count: result.total_count,
      success_count: result.success_count,
      error_count: result.error_count,
      errors: result.errors || [],
      message: `Imported ${result.success_count} of ${result.total_count} members`,
    }, {
      status: result.error_count > 0 ? 207 : 201, // 207 Multi-Status if partial success
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Bulk import API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
