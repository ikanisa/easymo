import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/observability/logger";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { profile } = await requireUserAndProfile();
    const merchantId = params.id;

    const supabase = createSupabaseServiceRoleClient("tapmomo/merchant-key");

    // Get merchant and verify access
    // Cast to any since tapmomo_merchants is in app schema not included in generated types
    const { data: merchant, error: merchantError } = await (supabase as any)
      .schema("app")
      .from("tapmomo_merchants")
      .select("id, sacco_id, secret_key")
      .eq("id", merchantId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    // Check if user has access to this merchant's SACCO
    const { data: staffProfile } = await (supabase.schema("app") as any)
      .from("staff_profiles")
      .select("sacco_id, role")
      .eq("user_id", profile.id)
      .single();

    if (
      !staffProfile ||
      (staffProfile.sacco_id !== merchant.sacco_id && staffProfile.role !== "admin")
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Return secret key as base64 string for use in client
    const secretKeyBase64 = Buffer.from(merchant.secret_key).toString("base64");

    return NextResponse.json({
      secret_key: secretKeyBase64,
    });
  } catch (error: any) {
    logError("Error fetching merchant key:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
