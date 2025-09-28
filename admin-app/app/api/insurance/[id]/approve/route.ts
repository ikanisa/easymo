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
    status: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

const paramsSchema = z.object({
  id: z.string().min(1),
});

const bodySchema = z.object({
  reviewerId: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  try {
    const { id } = paramsSchema.parse(context.params);
    const payload = bodySchema.parse(await request.json());

    const adminClient = getSupabaseAdminClient();
    if (adminClient) {
      const { error } = await adminClient
        .from("insurance_quotes")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.error("Failed to approve insurance quote in Supabase", error);
      }
    }

    const bridgeResult = await callBridge(
      "insuranceWorkflow",
      {
        action: "approve",
        quoteId: id,
        reviewerId: payload.reviewerId ?? null,
      },
    );

    await recordAudit({
      actor: "admin:mock",
      action: "insurance_approve",
      targetTable: "insurance_quotes",
      targetId: id,
      summary: bridgeResult.ok
        ? "Quote approval dispatched"
        : "Quote approved (degraded)",
    });

    if (bridgeResult.ok) {
      const parsed = bridgeResponseSchema.safeParse(bridgeResult.data);
      if (parsed.success) {
        return NextResponse.json(
          {
            quoteId: id,
            status: parsed.data.status ?? "approved",
            message: parsed.data.message ?? "Quote approval dispatched.",
            integration: bridgeHealthy("insuranceWorkflow"),
          },
          { status: 200 },
        );
      }
      console.error(
        "Insurance approve bridge returned unexpected payload",
        parsed.error,
      );
      return NextResponse.json(
        {
          quoteId: id,
          status: "approved",
          message: "Approval dispatched but response was invalid.",
          integration: {
            target: "insuranceWorkflow",
            status: "degraded",
            reason: "http_error",
            message: "Insurance approval bridge returned unexpected payload.",
          },
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        quoteId: id,
        status: "approved",
        message: bridgeResult.message,
        integration: bridgeDegraded("insuranceWorkflow", bridgeResult),
      },
      { status: bridgeResult.reason === "missing_endpoint" ? 200 : 502 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "invalid_request",
        details: error.flatten(),
      }, { status: 400 });
    }
    console.error("Failed to approve insurance quote", error);
    return NextResponse.json({ error: "insurance_approve_failed" }, {
      status: 500,
    });
  }
}
