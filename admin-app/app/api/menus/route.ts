import { NextResponse } from "next/server";
import { z } from "zod";
import { logStructured } from "@/lib/server/logger";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { createHandler } from "@/app/api/withObservability";

const querySchema = z.object({
  status: z.enum(["draft", "published"]).optional(),
  barId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const GET = createHandler('admin_api.menus.list', async (request, _context, { recordMetric }) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    recordMetric('menus.supabase_unavailable', 1);
    return NextResponse.json(
      {
        error: "supabase_unavailable",
        message: "Supabase credentials missing. Unable to fetch menu versions.",
      },
      { status: 503 },
    );
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    recordMetric('menus.invalid_query', 1);
    return NextResponse.json(
      {
        error: "invalid_query",
        message: error instanceof z.ZodError ? error.flatten() : "Invalid query parameters.",
      },
      { status: 400 },
    );
  }

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 100;

  const supabaseQuery = adminClient
    .from("menus")
    .select(
      `id, bar_id, version, status, source, updated_at, created_at,
       bars:bars(name),
       categories:categories(count),
       items:items(count)` ,
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (query.status) {
    supabaseQuery.eq("status", query.status);
  }
  if (query.barId) {
    supabaseQuery.eq("bar_id", query.barId);
  }

  const { data, error, count } = await supabaseQuery;
  if (error) {
    logStructured({
      event: "menus_fetch_failed",
      target: "menus",
      status: "error",
      message: error.message,
    });
    recordMetric('menus.supabase_error', 1, { message: error.message });
    return NextResponse.json(
      { error: "menus_fetch_failed", message: "Unable to load menu versions." },
      { status: 500 },
    );
  }

  const rows = (data ?? []).map((row) => {
    const categoryCount = Array.isArray(row.categories) && row.categories.length
      ? Number(row.categories[0]?.count ?? 0)
      : 0;
    const itemCount = Array.isArray(row.items) && row.items.length
      ? Number(row.items[0]?.count ?? 0)
      : 0;

    return {
      id: row.id,
      barId: row.bar_id,
      barName: row.bars?.name ?? "Unknown bar",
      version: `v${row.version ?? 1}`,
      status: row.status ?? "draft",
      source: row.source ?? "manual",
      categories: categoryCount,
      items: itemCount,
      updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    };
  });

  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;
  recordMetric('menus.success', 1, { total });

  return NextResponse.json({ data: rows, total, hasMore }, { status: 200 });
});
