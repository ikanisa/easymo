export const dynamic = "force-dynamic";

import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonError, jsonOk, zodValidationError } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { logStructured } from "@/lib/server/logger";

const querySchema = z.object({
  search: z.string().optional(),
  verified: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const createSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  description: z.string().min(4),
  tags: z.array(z.string().min(2)).min(1).max(5),
  businessLocation: z.string().min(3),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  whatsappCatalogUrl: z.string().url().optional(),
  openingHours: z.string().optional(),
});

type RawShopLocation =
  | { type?: string; coordinates?: unknown }
  | { type?: string; geometry?: { type?: string; coordinates?: unknown } | null }
  | { lat?: unknown; lng?: unknown; latitude?: unknown; longitude?: unknown; x?: unknown; y?: unknown }
  | readonly unknown[]
  | null;

type ShopRow = {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  whatsapp_catalog_url: string | null;
  phone: string | null;
  opening_hours: string | null;
  verified: boolean | null;
  status: string | null;
  rating: number | null;
  total_reviews: number | null;
  location: RawShopLocation;
  location_text: string | null;
  created_at: string;
  updated_at: string;
};

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readCoordinateArray(value: unknown) {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const lng = toNumber(value[0]);
  const lat = toNumber(value[1]);

  if (lat == null || lng == null) {
    return null;
  }

  return { lat, lng };
}

function formatLocation(value: ShopRow["location"]) {
  if (!value) {
    return null;
  }

  const coordinatesFromArray = readCoordinateArray(value);
  if (coordinatesFromArray) {
    return coordinatesFromArray;
  }

  if (typeof value === "object" && value !== null) {
    if ("geometry" in value && value.geometry && typeof value.geometry === "object") {
      const geometryCoordinates = readCoordinateArray((value.geometry as { coordinates?: unknown }).coordinates);
      if (geometryCoordinates) {
        return geometryCoordinates;
      }
    }

    if ("coordinates" in value) {
      const objectCoordinates = readCoordinateArray((value as { coordinates?: unknown }).coordinates);
      if (objectCoordinates) {
        return objectCoordinates;
      }
    }

    const lat =
      toNumber((value as { lat?: unknown }).lat) ??
      toNumber((value as { latitude?: unknown }).latitude) ??
      toNumber((value as { y?: unknown }).y);
    const lng =
      toNumber((value as { lng?: unknown }).lng) ??
      toNumber((value as { longitude?: unknown }).longitude) ??
      toNumber((value as { x?: unknown }).x);

    if (lat != null && lng != null) {
      return { lat, lng };
    }
  }

  return null;
}

export const GET = createHandler("admin_api.shops.list", async (request, _context, { recordMetric }) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    recordMetric("shops.supabase_unavailable", 1);
    return jsonError({ error: "supabase_unavailable", message: "Supabase credentials missing." }, 503);
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    recordMetric("shops.invalid_query", 1);
    return zodValidationError(error);
  }

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const supabaseQuery = adminClient
    .from("shops")
    .select(
      "id, name, description, tags, whatsapp_catalog_url, phone, opening_hours, verified, status, rating, total_reviews, location, location_text, created_at, updated_at",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (query.search) {
    supabaseQuery.ilike("name", `%${query.search}%`);
  }
  if (query.verified) {
    supabaseQuery.eq("verified", query.verified === "true");
  }

  const { data, error, count } = await supabaseQuery;
  if (error) {
    recordMetric("shops.supabase_error", 1, { message: error.message });
    logStructured({
      event: "shops_fetch_failed",
      target: "shops",
      status: "error",
      message: error.message,
    });
    return jsonError({ error: "shops_fetch_failed", message: "Unable to load shops." }, 500);
  }

  const rows = (data as ShopRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    tags: row.tags ?? [],
    whatsappCatalogUrl: row.whatsapp_catalog_url,
    phone: row.phone,
    openingHours: row.opening_hours,
    verified: Boolean(row.verified),
    status: row.status ?? "active",
    rating: row.rating ?? null,
    totalReviews: row.total_reviews ?? 0,
    businessLocation: row.location_text ?? null,
    coordinates: formatLocation(row.location),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  recordMetric("shops.success", 1, { total });

  return jsonOk({ data: rows, total, hasMore });
});

export const POST = createHandler("admin_api.shops.create", async (request, _context, { recordMetric }) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    recordMetric("shops.supabase_unavailable", 1);
    return jsonError({ error: "supabase_unavailable", message: "Supabase credentials missing." }, 503);
  }

  let body: z.infer<typeof createSchema>;
  try {
    const payload = await request.json();
    body = createSchema.parse(payload);
  } catch (error) {
    recordMetric("shops.invalid_payload", 1);
    return zodValidationError(error);
  }

  const insertPayload: Record<string, unknown> = {
    name: body.name,
    phone: body.phone ?? null,
    description: body.description,
    tags: body.tags,
    location_text: body.businessLocation,
    whatsapp_catalog_url: body.whatsappCatalogUrl ?? null,
    opening_hours: body.openingHours ?? null,
    verified: false,
    status: "active",
  };

  if (body.coordinates) {
    insertPayload.location = {
      type: "Point",
      coordinates: [body.coordinates.lng, body.coordinates.lat],
    };
  }

  const { data, error } = await adminClient
    .from("shops")
    .insert(insertPayload)
    .select(
      "id, name, description, tags, whatsapp_catalog_url, phone, opening_hours, verified, status, rating, total_reviews, location, location_text, created_at, updated_at",
    )
    .single();

  if (error) {
    recordMetric("shops.supabase_error", 1, { message: error.message });
    logStructured({
      event: "shops_create_failed",
      target: "shops",
      status: "error",
      message: error.message,
    });
    return jsonError({ error: "shops_create_failed", message: "Unable to create shop." }, 500);
  }

  recordMetric("shops.created", 1);

  return jsonOk({
    shop: {
      id: data!.id,
      name: data!.name,
      description: data!.description ?? "",
      tags: data!.tags ?? [],
      whatsappCatalogUrl: data!.whatsapp_catalog_url,
      phone: data!.phone,
      openingHours: data!.opening_hours,
      verified: Boolean(data!.verified),
      status: data!.status ?? "active",
      rating: data!.rating ?? null,
      totalReviews: data!.total_reviews ?? 0,
      businessLocation: data!.location_text ?? null,
      coordinates: formatLocation((data as ShopRow).location),
      createdAt: data!.created_at,
      updatedAt: data!.updated_at,
    },
  }, 201);
});

export const runtime = "nodejs";
