import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { recordAdminAudit } from "./audit.ts";
import {
  matchDriversForTrip,
  matchPassengersForTrip,
} from "../../rpc/mobility.ts";

const OPEN_LIMIT = 9;
const MATCH_LIMIT = 9;
const MATCH_RADIUS_METERS = 20000;
const MATCH_WINDOW_DAYS = 30;
const ALLOWED_STATUS = new Set([
  "open",
  "matched",
  "closed",
  "expired",
  "cancelled",
]);

function toTripRow(trip: any) {
  return {
    id: trip.id,
    role: trip.role,
    vehicle_type: trip.vehicle_type,
    status: trip.status,
    pickup_text: trip.pickup_text ?? null,
    dropoff_text: trip.dropoff_text ?? null,
    created_at: trip.created_at,
  };
}

export async function handleAdminTrips(
  req: FlowExchangeRequest,
  ctx: { waId: string },
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_open_trips":
    case "a_admin_refresh":
      return await listOpenTrips(req);
    case "a_admin_match_now":
      return await runMatchNow(req, ctx.waId);
    case "a_admin_trip_status":
      return await updateTripStatus(req, ctx.waId);
    case "a_admin_trip_expire":
      return await expireTrip(req, ctx.waId);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown trips action ${req.action_id}`,
        }],
      };
  }
}

async function listOpenTrips(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const { data, error } = await supabase
    .from("rides_trips")
    .select(
      "id, role, vehicle_type, status, pickup_text, dropoff_text, created_at",
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(OPEN_LIMIT);
  if (error) {
    await logStructuredEvent("ADMIN_TRIPS_LIST_FAIL", { error: error.message });
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to load trips." }],
    };
  }
  await logStructuredEvent("ADMIN_TRIPS_LIST_OK", { count: data?.length ?? 0 });
  return {
    next_screen_id: "s_trips_list",
    data: {
      trips: (data ?? []).map(toTripRow),
    },
  };
}

async function runMatchNow(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const tripId = typeof req.fields?.trip_id === "string"
    ? req.fields.trip_id
    : undefined;
  if (!tripId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing trip id." }],
    };
  }
  const { data: trip, error } = await supabase
    .from("rides_trips")
    .select("id, role, vehicle_type")
    .eq("id", tripId)
    .maybeSingle();
  if (error || !trip) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Trip not found." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_match_now",
    targetId: tripId,
  });
  const matches = trip.role === "passenger"
    ? await matchDriversForTrip(
      supabase,
      tripId,
      MATCH_LIMIT,
      false,
      MATCH_RADIUS_METERS,
      MATCH_WINDOW_DAYS,
    )
    : await matchPassengersForTrip(
      supabase,
      tripId,
      MATCH_LIMIT,
      false,
      MATCH_RADIUS_METERS,
      MATCH_WINDOW_DAYS,
    );
  await logStructuredEvent("ADMIN_TRIPS_MATCH_RESULT", {
    trip_id: tripId,
    count: matches.length,
  });
  return {
    next_screen_id: "s_trip_matches",
    data: {
      trip_id: tripId,
      matches,
    },
  };
}

async function updateTripStatus(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const tripId = typeof req.fields?.trip_id === "string"
    ? req.fields.trip_id
    : undefined;
  const newStatus = typeof req.fields?.new_status === "string"
    ? req.fields.new_status
    : undefined;
  const reason = typeof req.fields?.reason === "string"
    ? req.fields.reason
    : null;
  if (!tripId || !newStatus || !ALLOWED_STATUS.has(newStatus)) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Invalid status change." }],
    };
  }
  const { data: before, error } = await supabase
    .from("rides_trips")
    .select("id, status")
    .eq("id", tripId)
    .maybeSingle();
  if (error || !before) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Trip not found." }],
    };
  }
  const { error: updateError } = await supabase
    .from("rides_trips")
    .update({ status: newStatus })
    .eq("id", tripId);
  if (updateError) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to update status." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_trip_status",
    targetId: tripId,
    before: { status: before.status },
    after: { status: newStatus },
    reason,
  });
  return {
    next_screen_id: "s_trip_detail",
    messages: [{ level: "info", text: "Trip status updated." }],
    data: { trip_id: tripId, status: newStatus },
  };
}

async function expireTrip(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const tripId = typeof req.fields?.trip_id === "string"
    ? req.fields.trip_id
    : undefined;
  const reason = typeof req.fields?.reason === "string"
    ? req.fields.reason
    : null;
  if (!tripId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing trip id." }],
    };
  }
  const { error } = await supabase
    .from("rides_trips")
    .update({ status: "expired" })
    .eq("id", tripId);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to expire trip." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_trip_expire",
    targetId: tripId,
    after: { status: "expired" },
    reason,
  });
  return {
    next_screen_id: "s_trip_detail",
    messages: [{ level: "info", text: "Trip expired." }],
    data: { trip_id: tripId, status: "expired" },
  };
}
