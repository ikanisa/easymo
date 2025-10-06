import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { logStructured } from "@/lib/server/logger";

const querySchema = z.object({
  status: z.enum(["queued", "processing", "success", "error"]).optional(),
  barId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: "supabase_unavailable",
        message: "Supabase credentials missing. Unable to fetch OCR jobs.",
      },
      { status: 503 },
    );
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid_query",
        message: error instanceof z.ZodError ? error.flatten() : "Invalid query parameters.",
      },
      { status: 400 },
    );
  }

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;

  const supabaseQuery = adminClient
    .from("ocr_jobs")
    .select(
      `id, bar_id, menu_id, source_file_id, status, error_message, attempts, created_at, updated_at,
       bars:bars(name)` ,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
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
      event: "ocr_jobs_fetch_failed",
      target: "ocr_jobs",
      status: "error",
      message: error.message,
    });
    return NextResponse.json(
      { error: "ocr_jobs_fetch_failed", message: "Unable to load OCR jobs." },
      { status: 500 },
    );
  }

  const items = (data ?? []).map((row) => {
    const fileName = row.source_file_id ?? "menu";
    const extension = fileName.split(".").pop()?.toLowerCase();
    const type = extension === "pdf" ? "pdf" : "image";

    return {
      id: row.id,
      barId: row.bar_id,
      barName: row.bars?.name ?? "Unknown bar",
      fileName,
      type,
      status: row.status ?? "queued",
      durationSeconds: null,
      retries: row.attempts ?? 0,
      submittedAt: row.created_at ?? row.updated_at ?? new Date().toISOString(),
    };
  });

  const total = count ?? items.length;
  const hasMore = offset + items.length < total;

  return NextResponse.json({ data: items, total, hasMore }, { status: 200 });
}
