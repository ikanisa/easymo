import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { listCampaigns } from "@/lib/data-provider";
import { campaignSchema } from "@/lib/schemas";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { recordAudit } from "@/lib/server/audit";
import {
  bridgeDegraded,
  bridgeHealthy,
  callBridge,
} from "@/lib/server/edge-bridges";
import { withIdempotency } from "@/lib/server/idempotency";

const listQuerySchema = z.object({
  status: z.enum(["draft", "running", "paused", "done"]).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const listResponseSchema = z.object({
  data: z.array(campaignSchema),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

const draftInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["promo", "voucher"]),
  templateId: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = listQuerySchema.parse({
      status: (searchParams.get("status") as z.infer<
        typeof listQuerySchema
      >["status"]) ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const result = await listCampaigns(parsedQuery);
    const payload = listResponseSchema.parse(result);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "invalid_query",
        details: error.flatten(),
      }, { status: 400 });
    }
    console.error("Failed to list campaigns", error);
    return NextResponse.json({ error: "campaigns_list_failed" }, {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = draftInputSchema.parse(body);
    const now = new Date().toISOString();
    const idempotencyKey = headers().get("x-idempotency-key") ?? undefined;

    const result = await withIdempotency(idempotencyKey, async () => {
      const adminClient = getSupabaseAdminClient();

      if (adminClient) {
        const { data, error } = await adminClient
          .from("campaigns")
          .insert({
            name: parsed.name,
            type: parsed.type,
            status: "draft",
            template_id: parsed.templateId,
            metadata: parsed.metadata ?? {},
            created_at: now,
          })
          .select("id, name, type, status, template_id, created_at");

        if (!error && data) {
          const campaignBridgePayload = {
            id: data[0].id,
            name: data[0].name,
            type: data[0].type,
            templateId: data[0].template_id,
            metadata: parsed.metadata ?? {},
          };

          const bridgeResult = await callBridge("campaignDispatch", {
            action: "create",
            campaign: campaignBridgePayload,
          });

          await recordAudit({
            actor: "admin:mock",
            action: "campaign_create",
            targetTable: "campaigns",
            targetId: data[0].id,
            summary: `Campaign ${parsed.name} created`,
          });

          return {
            status: 201,
            payload: {
              campaign: {
                id: data[0].id,
                name: data[0].name,
                type: data[0].type,
                status: data[0].status,
                templateId: data[0].template_id,
                createdAt: data[0].created_at,
                startedAt: null,
                metadata: parsed.metadata ?? {},
              },
              message: "Draft saved.",
              integration: bridgeResult.ok
                ? bridgeHealthy("campaignDispatch")
                : bridgeDegraded("campaignDispatch", bridgeResult),
            },
          };
        }

        console.error(
          "Supabase campaign insert failed, falling back to mock",
          error,
        );
      }

      const draft = {
        id: `draft-${Math.random().toString(36).slice(2, 10)}`,
        name: parsed.name,
        type: parsed.type,
        status: "draft" as const,
        templateId: parsed.templateId,
        createdAt: now,
        startedAt: null,
        metadata: parsed.metadata ?? {},
      };

      const bridgeResult = await callBridge("campaignDispatch", {
        action: "create",
        campaign: {
          id: draft.id,
          name: draft.name,
          type: draft.type,
          templateId: draft.templateId,
          metadata: draft.metadata,
        },
      });

      await recordAudit({
        actor: "admin:mock",
        action: "campaign_create",
        targetTable: "campaigns",
        targetId: draft.id,
        summary: `Campaign ${parsed.name} created (mock)`,
      });

      return {
        status: 201,
        payload: {
          campaign: draft,
          message: "Draft saved (mock).",
          integration: bridgeResult.ok
            ? bridgeHealthy("campaignDispatch")
            : bridgeDegraded("campaignDispatch", bridgeResult),
        },
      };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "invalid_payload",
        details: error.flatten(),
      }, { status: 400 });
    }
    console.error("Failed to create campaign draft", error);
    return NextResponse.json({ error: "campaign_create_failed" }, {
      status: 500,
    });
  }
}
