import { NextResponse } from "next/server";
import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { logStructured } from "@/lib/server/logger";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = createHandler('admin_api.order_events.list', async (request, _context, { recordMetric }) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    recordMetric('order_events.supabase_unavailable', 1);
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to fetch order events.' }, 503);
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    recordMetric('order_events.invalid_query', 1);
    return zodValidationError(error);
  }

  const limit = query.limit ?? 10;

  const { data, error } = await adminClient
    .from("order_events")
    .select("id, order_id, type, status, actor_id, note, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logStructured({
      event: "order_events_fetch_failed",
      target: "order_events",
      status: "error",
      message: error.message,
    });
    recordMetric('order_events.supabase_error', 1, { message: error.message });
    return jsonError({ error: 'order_events_fetch_failed', message: 'Unable to load order events.' }, 500);
  }

  const rows = (data ?? []).map((row) => ({
    id: String(row.id),
    orderId: row.order_id ?? "",
    type: row.type ?? "unknown",
    status: row.status ?? null,
    actor: row.actor_id ?? null,
    note: row.note ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  }));

  recordMetric('order_events.success', 1, { count: rows.length });
  return jsonOk({ data: rows });
});
import { jsonOk, jsonError, zodValidationError } from "@/lib/api/http";
