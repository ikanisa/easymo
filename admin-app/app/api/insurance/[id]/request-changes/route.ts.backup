import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { jsonError, jsonOk, zodValidationError } from "@/lib/api/http";
import { recordAudit } from "@/lib/server/audit";
import { requireActorId, UnauthorizedError } from "@/lib/server/auth";
import { bridgeDegraded, bridgeHealthy, callBridge } from "@/lib/server/edge-bridges";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

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
  comment: z.string().min(1),
});

export const dynamic = "force-dynamic";

export const POST = createHandler("admin_api.insurance.id.request_changes", async (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = paramsSchema.parse(await context.params);
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
        .update({ status: "needs_changes", reviewer_comment: payload.comment })
        .eq("id", id);
      if (error) {
        console.error("Failed to request changes in Supabase", error);
      }
    }

    const bridgeResult = await callBridge(
      "insuranceWorkflow",
      {
        action: "request_changes",
        quoteId: id,
        reviewerId: payload.reviewerId ?? null,
        comment: payload.comment,
      },
    );

    await recordAudit({
      actorId,
      action: "insurance_request_changes",
      targetTable: "insurance_quotes",
      targetId: id,
      diff: { comment: payload.comment, degraded: !bridgeResult.ok },
    });

    if (bridgeResult.ok) {
      const parsed = bridgeResponseSchema.safeParse(bridgeResult.data);
      if (parsed.success) {
        return jsonOk({
          quoteId: id,
          status: parsed.data.status ?? "needs_changes",
          comment: payload.comment,
          message: parsed.data.message ?? "Change request dispatched.",
          integration: bridgeHealthy("insuranceWorkflow"),
        });
      }
      console.error(
        "Insurance request-changes bridge returned unexpected payload",
        parsed.error,
      );
      return jsonOk({
        quoteId: id,
        status: "needs_changes",
        comment: payload.comment,
        message: "Change request dispatched but response was invalid.",
        integration: {
          target: "insuranceWorkflow",
          status: "degraded",
          reason: "http_error",
          message: "Insurance request-changes bridge returned unexpected payload.",
        },
      }, 502);
    }

    return jsonOk({
      quoteId: id,
      status: "needs_changes",
      comment: payload.comment,
      message: bridgeResult.message,
      integration: bridgeDegraded("insuranceWorkflow", bridgeResult),
    }, bridgeResult.reason === "missing_endpoint" ? 200 : 502);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodValidationError(error);
    }
    console.error("Failed to request quote changes", error);
    return jsonError({ error: "insurance_request_changes_failed" }, 500);
  }
});

export const runtime = "nodejs";
