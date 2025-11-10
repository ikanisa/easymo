import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const listParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  status: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  intentId: z.string().uuid().optional(),
});

const quoteSchema = z.object({
  userId: z.string().uuid().nullable().optional(),
  intentId: z.string().uuid().nullable().optional(),
  status: z.string().optional(),
  premium: z.number().nullable().optional(),
  insurer: z.string().nullable().optional(),
  uploadedDocs: z.array(z.string()).optional(),
  reviewerComment: z.string().nullable().optional(),
  approvedAt: z.string().datetime().nullable().optional(),
});

const createQuotesSchema = z.object({
  quotes: z.array(quoteSchema).min(1),
});

function mapRow(row: Record<string, any>) {
  return {
    id: row.id as string,
    userId: (row.user_id as string | null | undefined) ?? null,
    intentId: (row.intent_id as string | null | undefined) ?? null,
    status: (row.status as string | null) ?? "pending",
    premium: row.premium === null || row.premium === undefined
      ? null
      : typeof row.premium === "number"
      ? row.premium
      : Number(row.premium),
    insurer: (row.insurer as string | null) ?? null,
    uploadedDocs: (row.uploaded_docs as string[] | null | undefined) ?? [],
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | null | undefined) ?? null,
    approvedAt: (row.approved_at as string | null | undefined) ?? null,
    reviewerComment: (row.reviewer_comment as string | null | undefined) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null | undefined) ?? null,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listParamsSchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params", issues: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const { limit, offset, status, search, intentId } = parsed.data;
  let query = admin
    .from("insurance_quotes")
    .select(
      "id, user_id, status, premium, insurer, uploaded_docs, created_at, updated_at, approved_at, reviewer_comment, intent_id",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  if (intentId) {
    query = query.eq("intent_id", intentId);
  }

  if (search) {
    query = query.or(`id.ilike.%${search}%,insurer.ilike.%${search}%`);
  }

  let { data, error, count } = await query;
  if (error && intentId && (error.code === "42703" || error.message?.includes("intent_id"))) {
    const fallback = await admin
      .from("insurance_quotes")
      .select(
        "id, user_id, status, premium, insurer, uploaded_docs, created_at, updated_at, approved_at, reviewer_comment",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    data = fallback.data;
    error = fallback.error;
    count = fallback.count;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map(mapRow);
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return NextResponse.json({ data: rows, total, hasMore });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = createQuotesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const payload = parsed.data.quotes.map((quote) => ({
    user_id: quote.userId ?? null,
    status: quote.status ?? "pending",
    premium: quote.premium ?? null,
    insurer: quote.insurer ?? null,
    uploaded_docs: quote.uploadedDocs ?? [],
    reviewer_comment: quote.reviewerComment ?? null,
    approved_at: quote.approvedAt ?? null,
  }));

  const { data, error } = await admin
    .from("insurance_quotes")
    .insert(payload)
    .select(
      "id, user_id, status, premium, insurer, uploaded_docs, created_at, updated_at, approved_at, reviewer_comment, intent_id",
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: (data ?? []).map(mapRow) }, { status: 201 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
