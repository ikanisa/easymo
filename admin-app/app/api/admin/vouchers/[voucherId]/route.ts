export const dynamic = 'force-dynamic';
import { jsonOk } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { parseAdminVoucherDetailFromFlowExchange } from "@/lib/flow-exchange/admin-vouchers";
import { mockAdminVoucherDetail } from "@/lib/mock-data";
import { createHandler } from "@/app/api/withObservability";

function withMessage(message: string) {
  return {
    ...mockAdminVoucherDetail,
    messages: [...mockAdminVoucherDetail.messages, message],
  };
}

export const GET = createHandler("admin_api.admin_vouchers.detail", async (
  _request: Request,
  { params }: { params: { voucherId: string } },
) => {
  const adminClient = getSupabaseAdminClient();
  const adminWaId = process.env.ADMIN_FLOW_WA_ID;

  if (!adminClient || !adminWaId) {
    return jsonOk(
      withMessage(
        "Admin flow bridge not configured. Set SUPABASE credentials and ADMIN_FLOW_WA_ID to load live voucher detail.",
      ),
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
      return jsonOk(
        withMessage(
          "Failed to load live voucher detail. Showing mock data instead.",
        ),
        502,
      );
    }

    const snapshot = parseAdminVoucherDetailFromFlowExchange(data);
    return jsonOk(snapshot);
  } catch (error) {
    console.error("Admin voucher detail API error", error);
    return jsonOk(
      withMessage(
        "Unexpected error while loading voucher detail. Showing mock data instead.",
      ),
      500,
    );
  }
});
