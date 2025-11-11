export const dynamic = "force-dynamic";

import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonOk, zodValidationError } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const fallbackShops = [
  {
    id: "shop-1",
    name: "Downtown Essentials",
    categories: ["groceries"],
    rating: 4.5,
    verified: true,
    location: "Kigali Heights",
    phone: "+250788000000",
    status: "active",
    deliveryEta: 25,
  },
  {
    id: "shop-2",
    name: "Nyamirambo Fabrics",
    categories: ["fashion"],
    rating: 4.2,
    verified: false,
    location: "Nyamirambo Main Road",
    phone: "+250788123456",
    status: "onboarding",
    deliveryEta: 40,
  },
];

function fallback(message: string) {
  return jsonOk({
    shops: fallbackShops,
    total: fallbackShops.length,
    hasMore: false,
    integration: {
      status: "degraded" as const,
      target: "agents_shops",
      message,
      remediation:
        "Check Supabase credentials or ensure shops/search_nearby_shops are deployed.",
    },
  });
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
      return fallback("Supabase admin client unavailable.");
    }

    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    const query = admin
      .from("shops")
      .select(
        "id, name, categories, rating, verified, location_text, phone, status, delivery_eta_minutes",
        { count: "exact" },
      )
      .order("verified", { ascending: false })
      .order("rating", { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.search) {
      const pattern = `%${params.search}%`;
      query.or(`name.ilike.${pattern},location_text.ilike.${pattern}`);
    }

    const { data, error, count } = await query;
    if (error) {
      recordMetric("agents.shops.supabase_error", 1, {
        message: error.message,
      });
      return fallback(error.message ?? "Unknown Supabase error.");
    }

    const rows = data ?? [];
    const total = count ?? rows.length;
    const hasMore = offset + rows.length < total;

    const shops = rows.map((row) => ({
      id: row.id,
      name: row.name ?? "Unknown shop",
      categories: row.categories ?? [],
      rating: row.rating ?? null,
      verified: row.verified ?? false,
      location: row.location_text ?? null,
      phone: row.phone ?? null,
      status: row.status ?? "active",
      deliveryEta: row.delivery_eta_minutes ?? null,
    }));

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
