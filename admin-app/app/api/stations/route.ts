import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { listStations } from "@/lib/data-provider";
import { recordAudit } from "@/lib/server/audit";
import {
  bridgeDegraded,
  bridgeHealthy,
  callBridge,
} from "@/lib/server/edge-bridges";
import { withIdempotency } from "@/lib/server/idempotency";

const stationListResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      engencode: z.string(),
      ownerContact: z.string().nullable(),
      status: z.string(),
      updatedAt: z.string(),
    }),
  ),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

const createStationSchema = z.object({
  name: z.string().min(1),
  engencode: z.string().min(1),
  ownerContact: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await listStations({ limit: 500 });
  return NextResponse.json(stationListResponse.parse(result));
}

export async function POST(request: Request) {
  try {
    const payload = createStationSchema.parse(await request.json());
    const idempotencyKey = headers().get("x-idempotency-key") ?? undefined;

    const result = await withIdempotency(idempotencyKey, async () => {
      const { getSupabaseAdminClient } = await import(
        "@/lib/server/supabase-admin"
      );
      const adminClient = getSupabaseAdminClient();

      if (adminClient) {
        const { data, error } = await adminClient
          .from("stations")
          .insert({
            name: payload.name,
            engencode: payload.engencode,
            owner_contact: payload.ownerContact ?? null,
            status: payload.status,
          })
          .select("id, name, engencode, owner_contact, status, updated_at");

        if (!error && data?.[0]) {
          const stationForBridge = {
            id: data[0].id,
            name: data[0].name,
            engencode: data[0].engencode,
            ownerContact: data[0].owner_contact,
            status: data[0].status,
          };

          const bridgeResult = await callBridge("stationDirectory", {
            action: "create",
            station: stationForBridge,
          });

          await recordAudit({
            actor: "admin:mock",
            action: "station_create",
            targetTable: "stations",
            targetId: data[0].id,
            summary: `Station ${payload.name} created`,
          });

          return {
            status: 201,
            payload: {
              station: data[0],
              integration: bridgeResult.ok
                ? bridgeHealthy("stationDirectory")
                : bridgeDegraded("stationDirectory", bridgeResult),
            },
          };
        }

        console.error("Supabase station insert failed", error);
      }

      const fallbackId = `station-mock-${Date.now()}`;
      const bridgeResult = await callBridge("stationDirectory", {
        action: "create",
        station: {
          id: fallbackId,
          name: payload.name,
          engencode: payload.engencode,
          ownerContact: payload.ownerContact ?? null,
          status: payload.status,
        },
      });

      await recordAudit({
        actor: "admin:mock",
        action: "station_create",
        targetTable: "stations",
        targetId: fallbackId,
        summary: `Station ${payload.name} created (mock)`,
      });

      return {
        status: 201,
        payload: {
          station: {
            id: fallbackId,
            name: payload.name,
            engencode: payload.engencode,
            owner_contact: payload.ownerContact ?? null,
            status: payload.status,
            updated_at: new Date().toISOString(),
          },
          integration: bridgeResult.ok
            ? bridgeHealthy("stationDirectory")
            : bridgeDegraded("stationDirectory", bridgeResult),
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
    console.error("Failed to create station", error);
    return NextResponse.json({ error: "station_create_failed" }, {
      status: 500,
    });
  }
}
