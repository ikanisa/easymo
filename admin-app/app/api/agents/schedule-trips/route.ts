export const dynamic = "force-dynamic";

import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonOk, zodValidationError } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  status: z
    .enum(["pending", "searching", "matched", "completed", "cancelled"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const fallbackTrips = [
  {
    id: "sched-1",
    passengerRef: "+250788000111",
    pickup: "Kimironko Market",
    dropoff: "CBD Bus Park",
    scheduledTime: new Date(Date.now() + 3_600_000).toISOString(),
    recurrence: "weekdays",
    vehiclePreference: "Moto",
    status: "searching",
    maxPrice: 2500,
    nextRunAt: new Date(Date.now() + 3_600_000).toISOString(),
  },
  {
    id: "sched-2",
    passengerRef: "+250788000222",
    pickup: "Rugando Heights",
    dropoff: "Nyarutarama Tennis",
    scheduledTime: new Date(Date.now() + 7_200_000).toISOString(),
    recurrence: "once",
    vehiclePreference: "Cab",
    status: "pending",
    maxPrice: 8500,
    nextRunAt: null,
  },
];

function fallback(message: string) {
  return jsonOk({
    trips: fallbackTrips,
    integration: {
      status: "degraded" as const,
      target: "agents_schedule_trips",
      message,
      remediation:
        "Confirm scheduled_trips table exists and service role has access.",
    },
  });
}

export const GET = createHandler(
  "admin_api.agents.schedule_trips.list",
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
      recordMetric("agents.schedule_trips.supabase_missing", 1);
      return fallback("Supabase admin client unavailable.");
    }

    const limit = limit ?? 50;
    let query = admin
      .from("scheduled_trips")
      .select(
        "id, user_id, pickup_address, dropoff_address, scheduled_time, recurrence, vehicle_preference, status, max_price, next_run_at",
      )
      .order("scheduled_time", { ascending: true })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      recordMetric("agents.schedule_trips.supabase_error", 1, {
        message: error.message,
      });
      return fallback(
        `Supabase query failed: ${error.message ?? "unknown error"}`,
      );
    }

    const trips = (data ?? []).map((row) => ({
      id: row.id,
      passengerRef: row.user_id ?? null,
      pickup: row.pickup_address ?? "Pickup TBD",
      dropoff: row.dropoff_address ?? "Drop-off TBD",
      scheduledTime: row.scheduled_time ?? new Date().toISOString(),
      recurrence: row.recurrence ?? "once",
      vehiclePreference: row.vehicle_preference ?? "Moto",
      status: row.status ?? "pending",
      maxPrice: row.max_price !== null ? Number(row.max_price) : null,
      nextRunAt: row.next_run_at ?? null,
    }));

    return jsonOk({
      trips,
      integration: {
        status: "ok" as const,
        target: "agents_schedule_trips",
      },
    });
  },
);

export const runtime = "nodejs";

