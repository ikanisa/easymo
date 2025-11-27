export const dynamic = "force-dynamic";

import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { jsonOk, zodValidationError } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().min(1).max(50).optional(),
  rentalType: z.enum(["short_term", "long_term"]).optional(),
  bedrooms: z.coerce.number().int().min(0).max(10).optional(),
  minBudget: z.coerce.number().min(0).optional(),
  maxBudget: z.coerce.number().min(0).optional(),
});

const fallbackProperties = [
  {
    id: "prop-1",
    owner: "host@easymo.rw",
    rentalType: "long_term",
    bedrooms: 3,
    bathrooms: 2,
    price: 650_000,
    address: "Kigali, Nyarutarama",
    amenities: ["Furnished", "Wi-Fi", "Backup power"],
    images: [],
    distanceKm: 1.4,
    availableFrom: new Date().toISOString(),
    status: "available",
  },
  {
    id: "prop-2",
    owner: "agency@easymo.rw",
    rentalType: "short_term",
    bedrooms: 2,
    bathrooms: 1,
    price: 95_000,
    address: "Kigali, Kimihurura",
    amenities: ["Pool access", "Daily cleaning"],
    images: [],
    distanceKm: 3.2,
    availableFrom: new Date().toISOString(),
    status: "available",
  },
];

const DEFAULT_LAT = -1.94407;
const DEFAULT_LNG = 30.061885;

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function fallback(message: string) {
  return jsonOk({
    properties: fallbackProperties,
    integration: {
      status: "degraded" as const,
      target: "agents_property_rentals",
      message,
      remediation:
        "Confirm properties table + search_nearby_properties RPC exist in Supabase.",
    },
  });
}

export const GET = createHandler(
  "admin_api.agents.property_rentals.list",
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
      recordMetric("agents.property_rentals.supabase_missing", 1);
      return fallback("Supabase admin client unavailable.");
    }

    const { lat, lng, radiusKm, rentalType, bedrooms, minBudget, maxBudget } = params;
    const { data, error } = await admin.rpc("search_nearby_properties", {
      p_latitude: lat ?? DEFAULT_LAT,
      p_longitude: lng ?? DEFAULT_LNG,
      p_radius_km: radiusKm ?? 10,
      p_rental_type: rentalType ?? null,
      p_bedrooms: bedrooms ?? null,
      p_min_budget: minBudget ?? 0,
      p_max_budget: maxBudget ?? 9_999_999,
    });

    if (error) {
      recordMetric("agents.property_rentals.supabase_error", 1, {
        message: error.message,
      });
      return fallback(
        `Supabase RPC failed: ${error.message ?? "unknown error"}`,
      );
    }

    type RpcRow = {
      id: string;
      owner_name?: string | null;
      owner_id?: string | null;
      rental_type?: string | null;
      bedrooms?: number | string | null;
      bathrooms?: number | string | null;
      price?: number | string | null;
      address?: string | null;
      amenities?: string[] | null;
      images?: string[] | null;
      distance?: number | string | null;
      available_from?: string | null;
      status?: string | null;
    };
    const properties = ((data ?? []) as RpcRow[]).map((row) => ({
      id: row.id,
      owner: row.owner_name ?? row.owner_id ?? null,
      rentalType: row.rental_type ?? "long_term",
      bedrooms:
        typeof row.bedrooms === "number" ? Number(row.bedrooms) : toNumber(row.bedrooms),
      bathrooms:
        typeof row.bathrooms === "number" ? Number(row.bathrooms) : toNumber(row.bathrooms),
      price: row.price !== null ? Number(row.price) : null,
      address: row.address ?? "Unknown address",
      amenities: Array.isArray(row.amenities) ? row.amenities : [],
      images: Array.isArray(row.images) ? row.images : [],
      distanceKm:
        typeof row.distance === "number"
          ? Number(Number(row.distance).toFixed(2))
          : toNumber(row.distance),
      availableFrom: row.available_from ?? null,
      status: row.status ?? "available",
    }));

    return jsonOk({
      properties,
      integration: {
        status: "ok" as const,
        target: "agents_property_rentals",
      },
    });
  },
);

export const runtime = "nodejs";
