export const dynamic = "force-dynamic";

import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { jsonError, jsonOk, zodValidationError } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  status: z.enum(["published", "draft"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const GET = createHandler(
  "admin_api.flows.list",
  async (request, _context, { recordMetric }) => {
    let params: z.infer<typeof querySchema>;
    try {
      params = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    } catch (error) {
      return zodValidationError(error);
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      recordMetric("flows.supabase_unavailable", 1);
      return jsonOk({ data: [], total: 0, hasMore: false });
    }

    const { offset = 0, limit = 100, status } = params;
    // Use a generic source of flows metadata if available; fallback to empty
    // Here we read from a hypothetical table 'flows_meta' if present.
    const query = admin
      .from("flows_meta")
      .select("id, title, version, status, linked_endpoints, last_error_at", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) query.eq("status", status);

    const { data, error, count } = await query;
    if (error) {
      recordMetric("flows.select_error", 1, { message: error.message });
      // Return an empty dataset rather than mocks
      return jsonOk({ data: [], total: 0, hasMore: false });
    }

    const rows = (data ?? []).map((row: any) => ({
      id: String(row.id),
      title: row.title ?? "",
      version: row.version ?? "",
      status: row.status ?? "draft",
      linkedEndpoints: Array.isArray(row.linked_endpoints) ? row.linked_endpoints : [],
      lastErrorAt: row.last_error_at ?? null,
    }));

    const total = count ?? rows.length;
    const hasMore = offset + rows.length < total;

    return jsonOk({ data: rows, total, hasMore });
  },
);

export const runtime = "nodejs";

