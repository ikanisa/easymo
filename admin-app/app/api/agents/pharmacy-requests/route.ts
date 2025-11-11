export const dynamic = "force-dynamic";

import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonOk, zodValidationError } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const fallbackPharmacyRequests = [
  {
    id: "pharm-req-1",
    patient: "Alice",
    medications: ["Amoxicillin 500mg", "Paracetamol 1g"],
    status: "awaiting_quotes",
    urgency: "same_day",
    deliveryMode: "courier",
    createdAt: new Date().toISOString(),
    quotes: [
      {
        vendor: "CityPharma",
        price: 18500,
        etaMinutes: 35,
        stockStatus: "In stock",
      },
      {
        vendor: "Nyamirambo Health",
        price: 19000,
        etaMinutes: 50,
        stockStatus: "Limited stock",
      },
      {
        vendor: "Downtown Pharmacy",
        price: 21000,
        etaMinutes: 45,
        stockStatus: "In stock",
      },
    ],
  },
];

function fallback(message: string) {
  return jsonOk({
    requests: fallbackPharmacyRequests,
    total: fallbackPharmacyRequests.length,
    hasMore: false,
    integration: {
      status: "degraded" as const,
      target: "agents_pharmacy_requests",
      message,
      remediation:
        "Ensure pharmacy_requests and pharmacy_quotes views exist in Supabase.",
    },
  });
}

export const GET = createHandler(
  "admin_api.agents.pharmacy_requests.list",
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
      recordMetric("agents.pharmacy_requests.supabase_missing", 1);
      return fallback("Supabase admin client unavailable.");
    }

    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const requestQuery = admin
      .from("pharmacy_requests")
      .select(
        `id, customer_name, customer_phone, status, urgency, delivery_mode, notes, created_at, requested_items`,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await requestQuery;
    if (error) {
      recordMetric("agents.pharmacy_requests.supabase_error", 1, {
        message: error.message,
      });
      return fallback(
        `Supabase query failed: ${error.message ?? "unknown error"}`,
      );
    }

    const rows = data ?? [];
    const total = count ?? rows.length;
    const hasMore = offset + rows.length < total;
    const quoteQuery = admin
      .from("pharmacy_quotes_v")
      .select(
        "request_id, vendor_name, total_price, eta_minutes, stock_status",
      )
      .in(
        "request_id",
        rows.map((row) => row.id),
      );

    const { data: quoteRows } = rows.length
      ? await quoteQuery
      : { data: [], error: null };

    const groupedQuotes = new Map<string, any[]>();
    (quoteRows ?? []).forEach((quote) => {
      if (!groupedQuotes.has(quote.request_id)) {
        groupedQuotes.set(quote.request_id, []);
      }
      groupedQuotes.get(quote.request_id)!.push(quote);
    });

    const requests = rows.map((row) => {
      const quotes = groupedQuotes.get(row.id) ?? [];
      return {
        id: row.id,
        patient: row.customer_name ?? row.customer_phone ?? "Unknown patient",
        medications: Array.isArray(row.requested_items ?? [])
          ? row.requested_items
          : (row.requested_items ?? "")
              .split(",")
              .map((item: string) => item.trim())
              .filter(Boolean),
        status: row.status ?? "pending",
        urgency: row.urgency ?? "standard",
        deliveryMode: row.delivery_mode ?? "courier",
        notes: row.notes ?? null,
        createdAt: row.created_at ?? new Date().toISOString(),
        quotes: quotes.map((quote) => ({
          vendor: quote.vendor_name,
          price: quote.total_price ?? null,
          etaMinutes: quote.eta_minutes ?? null,
          stockStatus: quote.stock_status ?? null,
        })),
      };
    });

    return jsonOk({
      requests,
      total,
      hasMore,
      integration: {
        status: "ok" as const,
        target: "agents_pharmacy_requests",
      },
    });
  },
);

export const runtime = "nodejs";
