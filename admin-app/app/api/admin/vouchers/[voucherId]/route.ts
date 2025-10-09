import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { parseAdminVoucherDetailFromFlowExchange } from "@/lib/flow-exchange/admin-vouchers";
import { mockAdminVoucherDetail } from "@/lib/mock-data";

function withMessage(message: string) {
  return {
    ...mockAdminVoucherDetail,
    messages: [...mockAdminVoucherDetail.messages, message],
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { voucherId: string } },
) {
  const adminClient = getSupabaseAdminClient();
  const adminWaId = process.env.ADMIN_FLOW_WA_ID;

  if (!adminClient || !adminWaId) {
    return NextResponse.json(
      withMessage(
        "Admin flow bridge not configured. Set SUPABASE credentials and ADMIN_FLOW_WA_ID to load live voucher detail.",
      ),
      { status: 200 },
    );
  }

  try {
    const { data, error } = await adminClient.functions.invoke("flow-exchange", {
      body: {
        flow_id: "flow.admin.vouchers.v1",
        action_id: "a_admin_voucher_detail",
        wa_id: adminWaId,
        fields: { voucher_id: params.voucherId },
      },
    });

    if (error) {
      console.error("Admin voucher detail invocation failed", error);
      return NextResponse.json(
        withMessage(
          "Failed to load live voucher detail. Showing mock data instead.",
        ),
        { status: 502 },
      );
    }

    const snapshot = parseAdminVoucherDetailFromFlowExchange(data);
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error("Admin voucher detail API error", error);
    return NextResponse.json(
      withMessage(
        "Unexpected error while loading voucher detail. Showing mock data instead.",
      ),
      { status: 500 },
    );
  }
}
