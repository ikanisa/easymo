import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "edge";

const querySchema = z.object({
  sacco_id: z.string().uuid(),
  format: z.enum(["csv", "xlsx", "json"]).optional().default("csv"),
  ikimina_id: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "all"]).optional().default("ACTIVE"),
});

/**
 * GET /api/members/export
 * Export members list in various formats (CSV, Excel, JSON)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = querySchema.parse(searchParams);

    const supabase = await createClient();

    // Fetch all members for the SACCO
    let query = supabase
      .from("members")
      .select(
        `
        member_code,
        full_name,
        msisdn_masked,
        status,
        joined_at,
        created_at,
        ikimina:ikimina!members_ikimina_id_fkey (
          name,
          code
        ),
        accounts:accounts!accounts_member_id_fkey (
          account_type,
          balance,
          currency
        )
      `
      )
      .eq("sacco_id", params.sacco_id);

    // Apply filters
    if (params.status !== "all") {
      query = query.eq("status", params.status);
    }

    if (params.ikimina_id) {
      query = query.eq("ikimina_id", params.ikimina_id);
    }

    query = query.order("full_name", { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error("Members export query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch members for export" },
        { status: 500 }
      );
    }

    // Transform data for export
    const exportData = (data || []).map((member: any) => {
      const totalBalance = (member.accounts || []).reduce(
        (sum: number, acc: any) => sum + (acc.balance || 0),
        0
      );

      return {
        member_code: member.member_code,
        full_name: member.full_name,
        phone: member.msisdn_masked,
        group: member.ikimina?.name || "N/A",
        group_code: member.ikimina?.code || "N/A",
        status: member.status,
        total_balance: totalBalance,
        joined_date: member.joined_at ? new Date(member.joined_at).toLocaleDateString() : "N/A",
        registered_date: new Date(member.created_at).toLocaleDateString(),
      };
    });

    // Return based on format
    if (params.format === "json") {
      return NextResponse.json({
        data: exportData,
        total: exportData.length,
        exported_at: new Date().toISOString(),
      });
    }

    if (params.format === "csv") {
      // Generate CSV
      const headers = [
        "Member Code",
        "Full Name",
        "Phone",
        "Group",
        "Group Code",
        "Status",
        "Total Balance",
        "Joined Date",
        "Registered Date",
      ];

      const csvRows = [
        headers.join(","),
        ...exportData.map((row) =>
          [
            row.member_code,
            `"${row.full_name}"`,
            row.phone,
            `"${row.group}"`,
            row.group_code,
            row.status,
            row.total_balance,
            row.joined_date,
            row.registered_date,
          ].join(",")
        ),
      ];

      const csvContent = csvRows.join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="members-export-${Date.now()}.csv"`,
        },
      });
    }

    // For Excel, return JSON with instructions
    return NextResponse.json({
      message: "Excel export not yet implemented. Use CSV format.",
      suggestion: "format=csv",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Members export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
