import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/server/audit";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import {
  bridgeDegraded,
  bridgeHealthy,
  callBridge,
} from "@/lib/server/edge-bridges";

const bridgeResponseSchema = z
  .object({
    state: z.enum(["running", "paused", "done"]).optional(),
    message: z.string().optional(),
  })
  .passthrough();

const paramsSchema = z.object({
  id: z.string().min(1),
});

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: { id: string } },
) {
  try {
    const { id } = paramsSchema.parse(context.params);
    const adminClient = getSupabaseAdminClient();
    if (adminClient) {
      const { error } = await adminClient.from("campaigns").update({
        status: "paused",
      }).eq("id", id);
      if (error) {
        console.error("Failed to pause campaign in Supabase", error);
      }
    }

    const bridgeResult = await callBridge(
      "campaignDispatch",
      { action: "pause", campaignId: id },
    );

    await recordAudit({
      actor: "admin:mock",
      action: "campaign_pause",
      targetTable: "campaigns",
      targetId: id,
      summary: bridgeResult.ok
        ? "Campaign pause dispatched"
        : "Campaign pause requested (degraded)",
    });

    if (bridgeResult.ok) {
      const parsed = bridgeResponseSchema.safeParse(bridgeResult.data);
      if (parsed.success) {
        return NextResponse.json(
          {
            id,
            state: parsed.data.state ?? "paused",
            message: parsed.data.message ?? "Campaign pause dispatched.",
            integration: bridgeHealthy("campaignDispatch"),
          },
          { status: 200 },
        );
      }
      console.error(
        "Campaign pause bridge returned unexpected payload",
        parsed.error,
      );
      return NextResponse.json(
        {
          id,
          state: "paused",
          message: "Campaign pause dispatched but response was invalid.",
          integration: {
            target: "campaignDispatch",
            status: "degraded",
            reason: "http_error",
            message: "Campaign pause bridge returned unexpected payload.",
          },
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        id,
        state: "paused",
        message: bridgeResult.message,
        integration: bridgeDegraded("campaignDispatch", bridgeResult),
      },
      { status: bridgeResult.reason === "missing_endpoint" ? 200 : 502 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "invalid_params",
        details: error.flatten(),
      }, { status: 400 });
    }
    console.error("Failed to pause campaign", error);
    return NextResponse.json({ error: "campaign_pause_failed" }, {
      status: 500,
    });
  }
}
