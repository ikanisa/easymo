import { z } from "zod";
import { recordAudit } from "@/lib/server/audit";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { bridgeDegraded, bridgeHealthy, callBridge } from "@/lib/server/edge-bridges";
import { jsonOk, jsonError, zodValidationError } from "@/lib/api/http";
import { requireActorId, UnauthorizedError } from "@/lib/server/auth";
import { createHandler } from "@/app/api/withObservability";

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

export const POST = createHandler("admin_api.insurance.id.approve", async (
  request: Request,
  context: { params: { id: string } },
) => {
  try {
    const { id } = paramsSchema.parse(context.params);
    const payload = bodySchema.parse(await request.json());

    let actorId: string;
    try {
      actorId = requireActorId();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return jsonError({ error: "unauthorized", message: err.message }, 401);
      }
      throw err;
    }

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
      actorId: "admin:mock",
      action: "insurance_approve",
      targetTable: "insurance_quotes",
      targetId: id,
      diff: bridgeResult.ok
        ? { summary: "Quote approval dispatched" }
        : { summary: "Quote approved (degraded)" },
    });

    if (bridgeResult.ok) {
      const parsed = bridgeResponseSchema.safeParse(bridgeResult.data);
      if (parsed.success) {
        return jsonOk({
          quoteId: id,
          status: parsed.data.status ?? "approved",
          message: parsed.data.message ?? "Quote approval dispatched.",
          integration: bridgeHealthy("insuranceWorkflow"),
        });
      }
      console.error(
        "Insurance approve bridge returned unexpected payload",
        parsed.error,
      );
      return jsonOk({
        quoteId: id,
        status: "approved",
        message: "Approval dispatched but response was invalid.",
        integration: {
          target: "insuranceWorkflow",
          status: "degraded",
          reason: "http_error",
          message: "Insurance approval bridge returned unexpected payload.",
        },
      }, 502);
    }

    return jsonOk({
      quoteId: id,
      status: "approved",
      message: bridgeResult.message,
      integration: bridgeDegraded("insuranceWorkflow", bridgeResult),
    }, bridgeResult.reason === "missing_endpoint" ? 200 : 502);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodValidationError(error);
    }
    console.error("Failed to approve insurance quote", error);
    return jsonError({ error: "insurance_approve_failed" }, 500);
  }
});

export const runtime = "nodejs";
