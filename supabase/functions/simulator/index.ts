// Supabase Edge Function: simulator
//
// Provides a set of actions for the WhatsApp simulator: listing nearby
// drivers or passengers, scheduling new simulated trips, and looking up
// profiles by referral code.  All actions require an `x-api-key` header
// matching EASYMO_ADMIN_TOKEN.

import { serve } from "$std/http/server.ts";
import { getServiceClient } from "shared/supabase.ts";
import { requireAdmin } from "shared/auth.ts";
import { badRequest, ok, serverError } from "shared/http.ts";

const supabase = getServiceClient();

async function getSettings() {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

serve(async (req) => {
  const guard = requireAdmin(req);
  if (guard) return guard;
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  try {
    if (!action) return badRequest("action_required");
    if (action === "drivers" && req.method === "GET") {
      // Nearby drivers
      const lat = Number(url.searchParams.get("lat"));
      const lng = Number(url.searchParams.get("lng"));
      const vehicleType = url.searchParams.get("vehicle_type") ?? "";
      const radiusParam = url.searchParams.get("radius_km");
      const maxParam = url.searchParams.get("max");
      if (isNaN(lat) || isNaN(lng) || !vehicleType) {
        return badRequest("required_params_missing");
      }
      const settings = await getSettings();
      const radiusKm = radiusParam
        ? Number(radiusParam)
        : settings?.search_radius_km ?? 5;
      const max = maxParam ? Number(maxParam) : settings?.max_results ?? 10;
      const latDelta = radiusKm / 111;
      const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
      const { data, error } = await supabase
        .from("driver_presence")
        .select("*")
        .eq("vehicle_type", vehicleType)
        .gte("lat", lat - latDelta)
        .lte("lat", lat + latDelta)
        .gte("lng", lng - lngDelta)
        .lte("lng", lng + lngDelta)
        .order("last_seen", { ascending: false })
        .limit(max);
      if (error) throw error;
      return ok({ drivers: data ?? [] });
    }
    if (action === "passengers" && req.method === "GET") {
      // Nearby passenger trips.  If force_access is not provided return no access.
      const lat = Number(url.searchParams.get("lat"));
      const lng = Number(url.searchParams.get("lng"));
      const vehicleType = url.searchParams.get("vehicle_type") ?? "";
      const forceAccess = url.searchParams.get("force_access") === "1";
      const driverRefCode = url.searchParams.get("driver_ref_code") ??
        undefined;
      if (!forceAccess) return ok({ access: false, reason: "no_access" });
      if (isNaN(lat) || isNaN(lng) || !vehicleType) {
        return badRequest("required_params_missing");
      }
      const settings = await getSettings();
      const radiusKm = settings?.search_radius_km ?? 5;
      const max = settings?.max_results ?? 10;
      const latDelta = radiusKm / 111;
      const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("role", "passenger")
        .eq("vehicle_type", vehicleType)
        .gte("lat", lat - latDelta)
        .lte("lat", lat + latDelta)
        .gte("lng", lng - lngDelta)
        .lte("lng", lng + lngDelta)
        .order("created_at", { ascending: false })
        .limit(max);
      if (error) throw error;
      return ok({ access: true, trips: data ?? [] });
    }
    if (action === "profile" && req.method === "GET") {
      const ref = url.searchParams.get("ref");
      if (!ref) return badRequest("ref_required");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("ref_code", ref)
        .maybeSingle();
      if (error) throw error;
      return ok({ profile: data });
    }
    if (action === "schedule_passenger" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      const vehicleType = body.vehicle_type as string;
      const refCode = body.ref_code as string;
      if (isNaN(lat) || isNaN(lng) || !vehicleType || !refCode) {
        return badRequest("required_params_missing");
      }
      const { data, error } = await supabase
        .from("trips")
        .insert({
          creator_user_id: refCode,
          role: "passenger",
          vehicle_type: vehicleType,
          lat,
          lng,
        })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return ok({ trip: data });
    }
    if (action === "schedule_driver" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      const vehicleType = body.vehicle_type as string;
      const refCode = body.ref_code as string;
      const forceAccess = body.force_access === true;
      if (!forceAccess) return ok({ access: false, reason: "no_access" });
      if (isNaN(lat) || isNaN(lng) || !vehicleType || !refCode) {
        return badRequest("required_params_missing");
      }
      const { data, error } = await supabase
        .from("trips")
        .insert({
          creator_user_id: refCode,
          role: "driver",
          vehicle_type: vehicleType,
          lat,
          lng,
        })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return ok({ access: true, trip: data });
    }
    return badRequest("unknown_action");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return serverError(message);
  }
});
