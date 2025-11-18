export const dynamic = "force-dynamic";

import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonOk, zodValidationError, jsonError } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import type { Shop } from "@/lib/shops/types";

const querySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

type RawLocation =
  | { type?: string; coordinates?: unknown }
  | { type?: string; geometry?: { type?: string; coordinates?: unknown } | null }
  | { lat?: unknown; lng?: unknown; latitude?: unknown; longitude?: unknown; x?: unknown; y?: unknown }
  | readonly unknown[]
  | null;

type AgentShopRow = {
  id: string;
  name: string | null;
  description: string | null;
  tags: string[] | null;
  rating: number | null;
  verified: boolean | null;
  location_text: string | null;
  phone: string | null;
  status: string | null;
  delivery_eta_minutes: number | null;
  whatsapp_catalog_url: string | null;
  opening_hours: string | null;
  total_reviews: number | null;
  location: RawLocation;
  updated_at: string | null;
};

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readCoordinateArray(value: unknown) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lng = toNumber(value[0]);
  const lat = toNumber(value[1]);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function formatCoordinates(value: RawLocation) {
  if (!value) return null;
  const fromArray = readCoordinateArray(value);
  if (fromArray) return fromArray;

  if (typeof value === "object") {
    if ("geometry" in value && value.geometry && typeof value.geometry === "object") {
      const geometryCoordinates = readCoordinateArray((value.geometry as { coordinates?: unknown }).coordinates);
      if (geometryCoordinates) return geometryCoordinates;
    }
    if ("coordinates" in value) {
      const objectCoordinates = readCoordinateArray((value as { coordinates?: unknown }).coordinates);
      if (objectCoordinates) return objectCoordinates;
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

function normalizeTags(tags?: (string | null)[] | null): string[] {
  const cleaned = (tags ?? [])
    .map((tag) => tag?.trim())
    .filter((tag): tag is string => Boolean(tag));
  if (cleaned.length === 0) {
    return ["general"];
  }
  return cleaned.slice(0, 5);
}

function serializeShopRow(row: AgentShopRow) {
  return {
    id: row.id,
    name: row.name ?? "Unknown shop",
    description: row.description ?? "",
    tags: normalizeTags(row.tags),
    rating: row.rating ?? null,
    verified: Boolean(row.verified),
    businessLocation: row.location_text ?? null,
    phone: row.phone ?? null,
    status: row.status ?? "active",
    deliveryEta: row.delivery_eta_minutes ?? null,
    whatsappCatalogUrl: row.whatsapp_catalog_url ?? null,
    openingHours: row.opening_hours ?? null,
    totalReviews: row.total_reviews ?? 0,
    coordinates: formatCoordinates(row.location),
    updatedAt: row.updated_at,
  };
}

function _scoreShop(shop: Pick<Shop, "rating" | "verified" | "totalReviews" | "updatedAt">) {
  const ratingComponent = ((shop.rating ?? 3) / 5) * 0.6;
  const verifiedBonus = shop.verified ? 0.2 : 0;
  const reviewComponent = Math.min(shop.totalReviews, 200) / 200 * 0.15;
  const freshnessComponent =
    shop.updatedAt && Number.isFinite(Date.parse(shop.updatedAt))
      ? Math.max(0, 1 - (Date.now() - Date.parse(shop.updatedAt)) / (1000 * 60 * 60 * 24 * 30)) * 0.05
      : 0;
  return ratingComponent + verifiedBonus + reviewComponent + freshnessComponent;
}

function _serializeMockShop(shop: Shop) {
  return {
    id: shop.id,
    name: shop.name,
    description: shop.description,
    tags: normalizeTags(shop.tags),
    rating: shop.rating ?? null,
    verified: shop.verified,
    businessLocation: shop.businessLocation,
    phone: shop.phone,
    status: shop.status,
    deliveryEta: null,
    whatsappCatalogUrl: shop.whatsappCatalogUrl,
    openingHours: shop.openingHours,
    totalReviews: shop.totalReviews,
    coordinates: shop.coordinates,
    updatedAt: shop.updatedAt,
  };
}

function fallbackError(message: string, code = 503) {
  return jsonError({ error: 'unavailable', message }, code);
}

export const GET = createHandler(
  "admin_api.agents.shops.list",
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
      recordMetric("agents.shops.supabase_missing", 1);
      return fallbackError("Supabase admin client unavailable.");
    }

    const { limit = 50, offset = 0, search } = params;
    const query = admin
      .from("shops")
      .select(
        "id, name, description, tags, rating, verified, location_text, phone, status, delivery_eta_minutes, whatsapp_catalog_url, opening_hours, total_reviews, location, updated_at",
        { count: "exact" },
      )
      .order("verified", { ascending: false })
      .order("rating", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      const pattern = `%${search}%`;
      query.or(`name.ilike.${pattern},location_text.ilike.${pattern}`);
    }

    const { data, error, count } = await query;
    if (error) {
      recordMetric("agents.shops.supabase_error", 1, {
        message: error.message,
      });
      return fallbackError(error.message ?? "Unknown Supabase error.", 500);
    }

    const rows = (data as AgentShopRow[]) ?? [];
    const total = count ?? rows.length;
    const hasMore = offset + rows.length < total;
    const shops = rows.map(serializeShopRow);

    return jsonOk({
      shops,
      total,
      hasMore,
      integration: {
        status: "ok" as const,
        target: "agents_shops",
      },
    });
  },
);

export const runtime = "nodejs";
