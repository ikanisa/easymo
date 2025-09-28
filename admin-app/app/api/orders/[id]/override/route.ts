import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/server/audit";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const bodySchema = z.object({
  action: z.enum(["cancel", "nudge", "reopen"]),
  reason: z.string().min(1).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  try {
    const { id } = paramsSchema.parse(context.params);
    const payload = bodySchema.parse(await request.json());
    const { getSupabaseAdminClient } = await import(
      "@/lib/server/supabase-admin"
    );
    const adminClient = getSupabaseAdminClient();
    let message = "";
    let integration: {
      target: string;
      status: "ok" | "degraded";
      reason?: string;
      message?: string;
    } = {
      target: "orderOverride",
      status: "degraded",
      reason: "mock_store",
      message: "Order override stored locally; Supabase connection missing.",
    };

    if (adminClient) {
      if (payload.action === "cancel") {
        const { error } = await adminClient
          .from("orders")
          .update({
            status: "cancelled",
            cancelled_reason: payload.reason ?? "Admin cancelled",
          })
          .eq("id", id);
        if (error) {
          console.error("Supabase order cancel failed", error);
        } else {
          message = "Order cancelled.";
          integration = { target: "orderOverride", status: "ok" };
        }
      }
      if (payload.action === "reopen") {
        const { error } = await adminClient.from("orders").update({
          status: "pending",
        }).eq("id", id);
        if (error) {
          console.error("Supabase order reopen failed", error);
        } else {
          message = "Order reopened.";
          integration = { target: "orderOverride", status: "ok" };
        }
      }
    }

    if (!message) {
      message = payload.action === "nudge"
        ? "Vendor nudged (mock)."
        : `Order ${payload.action}ed (mock).`;
      if (payload.action === "nudge") {
        integration = {
          target: "orderOverride",
          status: "degraded",
          reason: "mock_store",
          message: "Nudge stored for manual follow-up.",
        };
      }
    }

    await recordAudit({
      actor: "admin:mock",
      action: `order_${payload.action}`,
      targetTable: "orders",
      targetId: id,
      summary: payload.reason ?? message,
    });

    return NextResponse.json({
      orderId: id,
      status: payload.action,
      message,
      integration,
    }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "invalid_request",
        details: error.flatten(),
      }, { status: 400 });
    }
    console.error("Order override failed", error);
    return NextResponse.json({ error: "order_override_failed" }, {
      status: 500,
    });
  }
}
