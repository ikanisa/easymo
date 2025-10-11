import { jsonOk } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { parseAdminVoucherListFromFlowExchange } from "@/lib/flow-exchange/admin-vouchers";
import { mockAdminVoucherList } from "@/lib/mock-data";
import { createHandler } from "@/app/api/withObservability";

function withMessage(message: string) {
  return {
    vouchers: mockAdminVoucherList.vouchers,
    messages: [...mockAdminVoucherList.messages, message],
  };
}

export const GET = createHandler("admin_api.admin_vouchers.recent", async () => {
  const adminClient = getSupabaseAdminClient();
  const adminWaId = process.env.ADMIN_FLOW_WA_ID;

  if (!adminClient || !adminWaId) {
    return jsonOk(
      withMessage(
        "Admin flow bridge not configured. Set SUPABASE credentials and ADMIN_FLOW_WA_ID to load live voucher data.",
      ),
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
      return jsonOk(
        withMessage(
          "Failed to load live vouchers. Showing mock list instead.",
        ),
        502,
      );
    }

    const snapshot = parseAdminVoucherListFromFlowExchange(data);
    return jsonOk(snapshot);
  } catch (error) {
    console.error("Admin voucher recent API error", error);
    return jsonOk(
      withMessage(
        "Unexpected error while loading vouchers. Showing mock list instead.",
      ),
      500,
    );
  }
});
