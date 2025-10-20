export const dynamic = 'force-dynamic';
import { jsonOk } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { parseAdminHubSnapshotFromFlowExchange } from "@/lib/flow-exchange/admin-hub";
import { mockAdminHubSnapshot } from "@/lib/mock-data";
import { createHandler } from "@/app/api/withObservability";

function withMessage(message: string) {
  return {
    sections: mockAdminHubSnapshot.sections,
    messages: [...mockAdminHubSnapshot.messages, message],
  };
}

export const GET = createHandler("admin_api.admin_hub.get", async () => {
  const adminClient = getSupabaseAdminClient();
  const adminWaId = process.env.ADMIN_FLOW_WA_ID;

  if (!adminClient || !adminWaId) {
    return jsonOk(
      withMessage(
        "Admin flow bridge not configured. Set SUPABASE credentials and ADMIN_FLOW_WA_ID to load live sections.",
      ),
    );
  }

  try {
    const { data, error } = await adminClient.functions.invoke("flow-exchange", {
      body: {
        flow_id: "flow.admin.hub.v1",
        action_id: "a_admin_load_hub",
        wa_id: adminWaId,
      },
    });

    if (error) {
      console.error("Admin hub flow invoke failed", error);
      return jsonOk(
        withMessage(
          "Failed to load live admin hub sections. Showing mock snapshot instead.",
        ),
        502,
      );
    }

    const snapshot = parseAdminHubSnapshotFromFlowExchange(data);
    return jsonOk(snapshot);
  } catch (error) {
    console.error("Admin hub API error", error);
    return jsonOk(withMessage("Unexpected error loading admin hub sections. Showing mock snapshot instead."));
  }
});
