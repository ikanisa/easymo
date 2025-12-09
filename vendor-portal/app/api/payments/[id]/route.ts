import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payments")
      .select(
        `
        *,
        member:members!payments_member_id_fkey (
          id,
          full_name,
          member_code,
          msisdn_masked,
          status
        ),
        ikimina:ikimina!payments_ikimina_id_fkey (
          id,
          name,
          code,
          type
        ),
        account:accounts!payments_account_id_fkey (
          id,
          account_type,
          balance,
          currency
        ),
        sms:sms_inbox!payments_sms_id_fkey (
          id,
          sender,
          message,
          received_at,
          parsed_data
        )
      `
      )
      .eq("id", params.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Payment not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Payment detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment" },
      { status: 500 }
    );
  }
}
