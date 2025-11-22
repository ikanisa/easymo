export const dynamic = 'force-dynamic';
import { createHandler } from "@/app/api/withObservability";
import { jsonError,jsonOk } from "@/lib/api/http";
import { parseAdminHubSnapshotFromFlowExchange } from "@/lib/flow-exchange/admin-hub";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

function degrade(message: string) {
  return jsonError({ error: 'unavailable', message }, 503);
}

export const GET = createHandler("admin_api.admin_hub.get", async () => {
  const adminClient = getSupabaseAdminClient();
  const adminWaId = process.env.ADMIN_FLOW_WA_ID;

  if (!adminClient || !adminWaId) {
    return degrade("Admin flow bridge not configured. Set SUPABASE credentials and ADMIN_FLOW_WA_ID to load live sections.");
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
      return jsonError({ error: 'upstream_failed', message: 'Failed to load admin hub sections.' }, 502);
    }

    const snapshot = parseAdminHubSnapshotFromFlowExchange(data);
    return jsonOk(snapshot);
  } catch (error) {
    console.error("Admin hub API error", error);
    return jsonError({ error: 'unknown', message: 'Unexpected error loading admin hub sections.' }, 500);
  }
});

export const runtime = "nodejs";
