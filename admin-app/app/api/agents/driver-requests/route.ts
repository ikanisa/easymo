export const dynamic = "force-dynamic";

import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonOk, zodValidationError } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.string().optional(),
});

const fallbackRequests = [
  {
    id: "mock-req-1",
    createdAt: new Date().toISOString(),
    pickup: "Downtown Kigali",
    dropoff: "Kimironko Market",
    vehicleType: "moto",
    status: "open",
    passengerRef: "P-1024",
  },
  {
    id: "mock-req-2",
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    pickup: "Kacyiru Police HQ",
    dropoff: "Kigali Heights",
    vehicleType: "cab",
    status: "in_progress",
    passengerRef: "P-1029",
  },
];

function fallbackResponse(message: string) {
  return jsonOk({
    requests: fallbackRequests,
    total: fallbackRequests.length,
    hasMore: false,
    integration: {
      status: "degraded" as const,
      target: "agents_driver_requests",
      message,
      remediation:
        "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to hydrate live trip data.",
    },
  });
}

export const GET = createHandler(
  "admin_api.agents.driver_requests.list",
  async (request, _context, { recordMetric }) => {
    let params: z.infer<typeof querySchema>;
    try {
      params = querySchema.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
    } catch (error) {
      return zodValidationError(error);
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      recordMetric("agents.driver_requests.supabase_missing", 1);
      return fallbackResponse("Supabase admin client unavailable.");
    }

    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const query = admin
      .from("trips")
      .select(
        `id, creator_user_id, vehicle_type, status, role, pickup_text, dropoff_text, pickup_lat, pickup_lng, created_at`,
        { count: "exact" },
      )
      .eq("role", "passenger")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.status) {
      query.eq("status", params.status);
    }

    const { data, error, count } = await query;
    if (error) {
      recordMetric("agents.driver_requests.supabase_error", 1, {
        message: error.message,
      });
      return fallbackResponse(
        `Supabase query failed: ${error.message ?? "unknown error"}`,
      );
    }

    const rows = data ?? [];
    const total = count ?? rows.length;
    const hasMore = offset + rows.length < total;

    const requests = rows.map((row) => ({
      id: row.id,
      passengerRef: row.creator_user_id ?? null,
      pickup: row.pickup_text ?? null,
      dropoff: row.dropoff_text ?? null,
      vehicleType: row.vehicle_type ?? null,
      status: row.status ?? null,
      createdAt: row.created_at ?? new Date().toISOString(),
      pickupLat: row.pickup_lat,
      pickupLng: row.pickup_lng,
    }));

    return jsonOk({
      requests,
      total,
      hasMore,
      integration: {
        status: "ok" as const,
        target: "agents_driver_requests",
      },
    });
  },
);

export const runtime = "nodejs";
