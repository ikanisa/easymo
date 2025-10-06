import { NextResponse } from "next/server";
import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { logStructured } from "@/lib/server/logger";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = createHandler('admin_api.webhook_errors.list', async (request, _context, { recordMetric }) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    recordMetric('webhook_errors.supabase_unavailable', 1);
    return NextResponse.json(
      {
        error: "supabase_unavailable",
        message: "Supabase credentials missing. Unable to fetch webhook errors.",
      },
      { status: 503 },
    );
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    recordMetric('webhook_errors.invalid_query', 1);
    return NextResponse.json(
      {
        error: "invalid_query",
        message: error instanceof z.ZodError ? error.flatten() : "Invalid query parameters.",
      },
      { status: 400 },
    );
  }

  const limit = query.limit ?? 10;

  const { data, error } = await adminClient
    .from("webhook_logs")
    .select("id, endpoint, error_message, status_code, received_at")
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error) {
    logStructured({
      event: "webhook_errors_fetch_failed",
      target: "webhook_logs",
      status: "error",
      message: error.message,
    });
    recordMetric('webhook_errors.supabase_error', 1, { message: error.message });
    return NextResponse.json(
      { error: "webhook_errors_fetch_failed", message: "Unable to load webhook errors." },
      { status: 500 },
    );
  }

  const rows = (data ?? []).map((row) => ({
    id: String(row.id),
    endpoint: row.endpoint ?? "unknown",
    failureReason: row.error_message ?? `HTTP ${row.status_code ?? 0}`,
    createdAt: row.received_at ?? new Date().toISOString(),
    retryUrl: null,
  }));

  recordMetric('webhook_errors.success', 1, { count: rows.length });
  return NextResponse.json({ data: rows }, { status: 200 });
});
