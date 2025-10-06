import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { parseAdminVoucherListFromFlowExchange } from "@/lib/flow-exchange/admin-vouchers";
import { mockAdminVoucherList } from "@/lib/mock-data";

function withMessage(message: string) {
  return {
    vouchers: mockAdminVoucherList.vouchers,
    messages: [...mockAdminVoucherList.messages, message],
  };
}

export async function GET() {
  const adminClient = getSupabaseAdminClient();
  const adminWaId = process.env.ADMIN_FLOW_WA_ID;

  if (!adminClient || !adminWaId) {
    return NextResponse.json(
      withMessage(
        "Admin flow bridge not configured. Set SUPABASE credentials and ADMIN_FLOW_WA_ID to load live voucher data.",
      ),
      { status: 200 },
    );
  }

  try {
    const { data, error } = await adminClient.functions.invoke("flow-exchange", {
      body: {
        flow_id: "flow.admin.vouchers.v1",
        action_id: "a_admin_voucher_recent",
        wa_id: adminWaId,
      },
    });

    if (error) {
      console.error("Admin voucher recent invocation failed", error);
      return NextResponse.json(
        withMessage(
          "Failed to load live vouchers. Showing mock list instead.",
        ),
        { status: 502 },
      );
    }

    const snapshot = parseAdminVoucherListFromFlowExchange(data);
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error("Admin voucher recent API error", error);
    return NextResponse.json(
      withMessage(
        "Unexpected error while loading vouchers. Showing mock list instead.",
      ),
      { status: 500 },
    );
  }
}
