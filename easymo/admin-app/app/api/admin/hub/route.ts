import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { parseAdminHubSnapshotFromFlowExchange } from "@/lib/flow-exchange/admin-hub";
import { mockAdminHubSnapshot } from "@/lib/mock-data";

function withMessage(message: string) {
  return {
    sections: mockAdminHubSnapshot.sections,
    messages: [...mockAdminHubSnapshot.messages, message],
  };
}

export async function GET() {
  const adminClient = getSupabaseAdminClient();
  const adminWaId = process.env.ADMIN_FLOW_WA_ID;

  if (!adminClient || !adminWaId) {
    return NextResponse.json(
      withMessage(
        "Admin flow bridge not configured. Set SUPABASE credentials and ADMIN_FLOW_WA_ID to load live sections.",
      ),
      { status: 200 },
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
      return NextResponse.json(
        withMessage(
          "Failed to load live admin hub sections. Showing mock snapshot instead.",
        ),
        { status: 502 },
      );
    }

    const snapshot = parseAdminHubSnapshotFromFlowExchange(data);
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error("Admin hub API error", error);
    return NextResponse.json(
      withMessage(
        "Unexpected error loading admin hub sections. Showing mock snapshot instead.",
      ),
      { status: 500 },
    );
  }
}
