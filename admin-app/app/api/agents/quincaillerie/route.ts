export const dynamic = "force-dynamic";

import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonOk, zodValidationError } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const fallbackVendors = [
  {
    id: "vendor-1",
    name: "Kimironko Hardware Hub",
    description: "Fast-turn hardware wholesaler covering plumbing + roofing.",
    phone: "+250788111222",
    verified: true,
    rating: 4.7,
    distanceKm: 2.1,
    status: "active",
  },
  {
    id: "vendor-2",
    name: "Nyamirambo Quinca",
    description: "Electrical and paint specialist for city refurb jobs.",
    phone: "+250788555000",
    verified: false,
    rating: 4.3,
    distanceKm: 4.5,
    status: "active",
  },
];

const DEFAULT_LAT = -1.953592;
const DEFAULT_LNG = 30.091703;

function fallback(message: string) {
  return jsonOk({
    vendors: fallbackVendors,
    total: fallbackVendors.length,
    integration: {
      status: "degraded" as const,
      target: "agents_quincaillerie",
      message,
      remediation:
        "Ensure vendors table + search_nearby_vendors RPC are deployed in Supabase.",
    },
  });
}

export const GET = createHandler(
  "admin_api.agents.quincaillerie.list",
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
      recordMetric("agents.quincaillerie.supabase_missing", 1);
      return fallback("Supabase admin client unavailable.");
    }

    const { lat, lng, radiusKm, limit } = params;
    const { data, error } = await admin.rpc("search_nearby_vendors", {
      p_latitude: lat ?? DEFAULT_LAT,
      p_longitude: lng ?? DEFAULT_LNG,
      p_vendor_type: "quincaillerie",
      p_radius_km: radiusKm ?? 10,
      p_limit: limit ?? 20,
    });

    if (error) {
      recordMetric("agents.quincaillerie.supabase_error", 1, {
        message: error.message,
      });
      return fallback(
        `Supabase RPC failed: ${error.message ?? "unknown error"}`,
      );
    }

    const vendors = (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name ?? "Unnamed vendor",
      description: row.description ?? null,
      phone: row.phone ?? null,
      verified: Boolean(row.verified),
      rating:
        typeof row.rating === "number" ? Number(row.rating) : row.rating ?? null,
      distanceKm:
        typeof row.distance === "number"
          ? Number(Number(row.distance).toFixed(2))
          : null,
      metadata: row.metadata ?? {},
      status: "active",
    }));

    return jsonOk({
      vendors,
      total: vendors.length,
      integration: {
        status: "ok" as const,
        target: "agents_quincaillerie",
      },
    });
  },
);

export const runtime = "nodejs";
