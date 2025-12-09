import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/observability/logger";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";

// GET - List transactions
export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireUserAndProfile();
    const supabase = createSupabaseServiceRoleClient("tapmomo/transactions");

    const searchParams = request.nextUrl.searchParams;
    const saccoId = searchParams.get("sacco_id");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Verify access
    const { data: staffProfile } = await (supabase.schema("app") as any)
      .from("staff_profiles")
      .select("sacco_id, role")
      .eq("user_id", profile.id)
      .single();

    if (!staffProfile) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 403 });
    }

    // Build query
    let query = (supabase.schema("app") as any)
      .from("tapmomo_transaction_summary")
      .select("*")
      .order("initiated_at", { ascending: false })
      .limit(limit);

    // Filter by SACCO if not admin
    if (staffProfile.role !== "admin" && staffProfile.sacco_id) {
      query = query.eq("sacco_id", staffProfile.sacco_id);
    } else if (saccoId) {
      query = query.eq("sacco_id", saccoId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: transactions, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      transactions: transactions || [],
    });
  } catch (error: any) {
    logError("Error fetching transactions:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// POST - Create transaction
export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireUserAndProfile();
    const supabase = createSupabaseServiceRoleClient("tapmomo/transactions");

    const body = await request.json();
    const { merchant_code, nonce, amount, currency = "RWF", ref, network, payload_ts } = body;

    // Validate required fields
    if (!merchant_code || !nonce || !network) {
      return NextResponse.json(
        { error: "Missing required fields: merchant_code, nonce, network" },
        { status: 400 }
      );
    }

    // Get merchant
    // Cast to any since tapmomo_merchants is in app schema not included in generated types
    const { data: merchant, error: merchantError } = await (supabase.schema("app") as any)
      .from("tapmomo_merchants")
      .select("id, sacco_id")
      .eq("merchant_code", merchant_code)
      .eq("is_active", true)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Merchant not found or inactive" }, { status: 404 });
    }

    // Verify access
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

    // Create transaction
    const { data: transaction, error: txError } = await (supabase as any).rpc(
      "create_tapmomo_transaction",
      {
        p_merchant_id: merchant.id,
        p_nonce: nonce,
        p_amount: amount || null,
        p_currency: currency,
        p_ref: ref || null,
        p_network: network,
        p_payload_ts: payload_ts || new Date().toISOString(),
        p_ttl_seconds: 120,
      }
    );

    if (txError) {
      throw txError;
    }

    return NextResponse.json({
      success: true,
      transaction_id: transaction,
    });
  } catch (error: any) {
    logError("Error creating transaction:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
