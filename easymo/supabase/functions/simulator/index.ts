import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  createServiceRoleClient,
  handleOptions,
  json,
  logRequest,
  logResponse,
  requireAdminAuth,
  withCors,
} from "../_shared/admin.ts";

type SupabaseLike = ReturnType<typeof createServiceRoleClient>;

let cachedClient: SupabaseLike | null = null;

export function setSupabaseClientForTesting(client: SupabaseLike | null) {
  cachedClient = client;
}

function getSupabase(): SupabaseLike {
  if (cachedClient) return cachedClient;
  cachedClient = createServiceRoleClient();
  return cachedClient;
}

const geoQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  vehicle_type: z.string().min(1),
  radius_km: z.coerce.number().positive().max(50).optional(),
  max: z.coerce.number().int().min(1).max(50).optional(),
});

const passengersQuerySchema = geoQuerySchema.extend({
  driver_ref_code: z.string().min(3).max(32).optional(),
  force_access: z.coerce.boolean().optional(),
});

const scheduleSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  vehicle_type: z.string().min(1),
  ref_code: z.string().min(3).max(32),
  force_access: z.boolean().optional(),
});

async function findProfileByRefCode(refCode: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("profiles")
    .select("user_id, whatsapp_e164, ref_code, credits_balance, created_at")
    .eq("ref_code", refCode)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function hasActiveSubscription(userId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("subscriptions")
    .select("status, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("expires_at", { ascending: false })
    .limit(1);
  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.length === 0) return false;
  const [row] = data;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

async function handleDrivers(searchParams: URLSearchParams) {
  const query = geoQuerySchema.parse(Object.fromEntries(searchParams));
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("simulator_find_nearby_drivers", {
    lat: query.lat,
    lng: query.lng,
    radius_km: query.radius_km,
    max_results: query.max,
    vehicle_type: query.vehicle_type,
  });
  if (error) {
    console.error("simulator.drivers_failed", error);
    return json({ error: "query_failed" }, 500);
  }
  const drivers = Array.isArray(data) ? data : [];
  logResponse("simulator", 200, { action: "drivers", count: drivers.length });
  return new Response(JSON.stringify({ drivers }), withCors({ status: 200 }));
}

async function handlePassengers(searchParams: URLSearchParams) {
  const query = passengersQuerySchema.parse(Object.fromEntries(searchParams));

  if (query.driver_ref_code && !query.force_access) {
    const profile = await findProfileByRefCode(query.driver_ref_code);
    if (!profile) {
      return json({ access: false, reason: "driver_not_found" }, 200);
    }
    const hasAccess = await hasActiveSubscription(profile.user_id);
    if (!hasAccess) {
      return json({ access: false, reason: "no_subscription" }, 200);
    }
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("simulator_find_nearby_passenger_trips", {
    lat: query.lat,
    lng: query.lng,
    radius_km: query.radius_km,
    max_results: query.max,
    vehicle_type: query.vehicle_type,
  });
  if (error) {
    console.error("simulator.passengers_failed", error);
    return json({ error: "query_failed" }, 500);
  }
  const payload = (data ?? {}) as Record<string, unknown>;
  logResponse("simulator", 200, { action: "passengers" });
  return json(payload);
}

async function handleSchedulePassenger(body: unknown) {
  const payload = scheduleSchema.omit({ force_access: true }).parse(body);
  const profile = await findProfileByRefCode(payload.ref_code);
  if (!profile) {
    return json({ error: "passenger_not_found" }, 404);
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.from("trips")
    .insert({
      creator_user_id: profile.user_id,
      role: "passenger",
      vehicle_type: payload.vehicle_type,
      status: "active",
      lat: payload.lat,
      lng: payload.lng,
    })
    .select("id, creator_user_id, role, vehicle_type, status, created_at, lat, lng")
    .single();
  if (error) {
    console.error("simulator.schedule_passenger_failed", error);
    return json({ error: "insert_failed" }, 500);
  }
  logResponse("simulator", 200, { action: "schedule_passenger", id: data.id });
  return json({ trip: data });
}

async function handleScheduleDriver(body: unknown) {
  const payload = scheduleSchema.parse(body);
  const profile = await findProfileByRefCode(payload.ref_code);
  if (!profile) {
    return json({ access: false, reason: "driver_not_found" }, 200);
  }
  if (!payload.force_access) {
    const hasAccess = await hasActiveSubscription(profile.user_id);
    if (!hasAccess) {
      return json({ access: false, reason: "no_subscription" }, 200);
    }
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.from("trips")
    .insert({
      creator_user_id: profile.user_id,
      role: "driver",
      vehicle_type: payload.vehicle_type,
      status: "active",
      lat: payload.lat,
      lng: payload.lng,
    })
    .select("id, creator_user_id, role, vehicle_type, status, created_at, lat, lng")
    .single();
  if (error) {
    console.error("simulator.schedule_driver_failed", error);
    return json({ error: "insert_failed" }, 500);
  }
  logResponse("simulator", 200, { action: "schedule_driver", id: data.id });
  return json({ access: true, trip: data });
}

async function handleProfile(searchParams: URLSearchParams) {
  const refCode = searchParams.get("ref_code");
  if (!refCode) {
    return json({ error: "missing_ref_code" }, 400);
  }
  const profile = await findProfileByRefCode(refCode);
  if (!profile) {
    return json({ profile: null }, 200);
  }
  return json({ profile });
}

export async function handler(req: Request): Promise<Response> {
  logRequest("simulator", req);

  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  const url = new URL(req.url);
  const action = (url.searchParams.get("action") ?? "drivers").toLowerCase();

  try {
    if (req.method === "GET") {
      if (action === "drivers") {
        return await handleDrivers(url.searchParams);
      }
      if (action === "passengers") {
        return await handlePassengers(url.searchParams);
      }
      if (action === "profile") {
        return await handleProfile(url.searchParams);
      }
      return json({ error: "invalid_action" }, 400);
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => {
        throw new Error("invalid_json");
      });
      if (action === "schedule_passenger") {
        return await handleSchedulePassenger(body);
      }
      if (action === "schedule_driver") {
        return await handleScheduleDriver(body);
      }
      return json({ error: "invalid_action" }, 400);
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json({ error: "invalid_payload" }, 400);
    }
    if (error instanceof Error && error.message === "invalid_json") {
      return json({ error: "invalid_json" }, 400);
    }
    console.error("simulator.unhandled", error);
    return json({ error: "internal_error" }, 500);
  }
}

Deno.serve(handler);
