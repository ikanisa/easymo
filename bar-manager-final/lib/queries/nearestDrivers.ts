import { QueryKey,useQuery, UseQueryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes/api";

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().nullable().optional(),
});

const nearestDriverSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullable().optional(),
    driver_id: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    full_name: z.string().nullable().optional(),
    vendor_name: z.string().nullable().optional(),
    wa_id: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    location: locationSchema.partial().nullable().optional(),
    distance_meters: z.number().nullable().optional(),
    distance_km: z.number().nullable().optional(),
    eta_minutes: z.number().nullable().optional(),
  })
  .passthrough()
  .transform((driver) => {
    const resolvedId = driver.driver_id ?? driver.id ?? driver.wa_id ?? crypto.randomUUID();
    const lat = driver.lat ?? driver.latitude ?? driver.location?.lat ?? null;
    const lng = driver.lng ?? driver.longitude ?? driver.location?.lng ?? null;
    const distanceKm = driver.distance_km ?? (driver.distance_meters != null ? driver.distance_meters / 1000 : null);
    return {
      id: String(resolvedId),
      driver_id: driver.driver_id ?? (typeof driver.id === "string" ? driver.id : null),
      name: driver.name ?? driver.full_name ?? driver.vendor_name ?? null,
      phone: driver.phone ?? null,
      lat,
      lng,
      distanceKm,
      etaMinutes: driver.eta_minutes ?? null,
      raw: driver as Record<string, unknown>,
    };
  });

type NearestDriverSchema = z.infer<typeof nearestDriverSchema>;

const matchResponseSchema = z.object({
  ride_id: z.string().optional(),
  drivers: z.array(nearestDriverSchema),
});

type MatchResponseSchema = z.infer<typeof matchResponseSchema>;

export interface NearestDriversParams {
  rideId?: string;
  pickup: { lat: number; lng: number };
  vehicleType?: string;
  limit?: number;
}

export type NearestDriver = NearestDriverSchema;

export async function fetchNearestDrivers(params: NearestDriversParams): Promise<MatchResponseSchema> {
  const payload = {
    ride_id: params.rideId ?? crypto.randomUUID(),
    vehicle_type: params.vehicleType ?? "sedan",
    pickup: params.pickup,
    limit: params.limit ?? 6,
  };
  const json = await apiFetch(getAdminApiPath("mobility", "match"), {
    method: "POST",
    body: payload,
    cache: "no-store",
  });
  return matchResponseSchema.parse(json);
}

export function getNearestDriversKey(params?: NearestDriversParams | null): QueryKey {
  if (!params) return ["nearest-drivers", "disabled"];
  const { rideId, pickup, vehicleType, limit } = params;
  return ["nearest-drivers", rideId ?? "anon", pickup.lat, pickup.lng, vehicleType ?? "any", limit ?? 6];
}

export function useNearestDriversQuery(
  params: NearestDriversParams | null,
  options?: UseQueryOptions<MatchResponseSchema, Error>,
) {
  return useQuery({
    queryKey: getNearestDriversKey(params),
    queryFn: () => {
      if (!params) throw new Error("nearest_drivers_params_missing");
      return fetchNearestDrivers(params);
    },
    enabled: Boolean(params),
    staleTime: 5_000,
    refetchInterval: 20_000,
    ...options,
  });
}

export type NearestDriversResponse = MatchResponseSchema;
