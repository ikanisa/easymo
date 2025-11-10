import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const listParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  quoteId: z.string().uuid().optional(),
  intentId: z.string().uuid().optional(),
  status: z.string().optional(),
});

function mapRow(row: Record<string, any>) {
  return {
    id: row.id as string,
    quoteId: (row.quote_id as string | null | undefined) ?? null,
    intentId: (row.intent_id as string | null | undefined) ?? null,
    amount: row.amount === null || row.amount === undefined
      ? 0
      : typeof row.amount === "number"
      ? row.amount
      : Number(row.amount),
    currency: (row.currency as string | null) ?? "RWF",
    status: (row.status as string | null) ?? "pending",
    channel: (row.channel as string | null) ?? null,
    reference: (row.reference as string | null) ?? null,
    recordedAt: (row.recorded_at as string | null | undefined) ?? null,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | null | undefined) ?? null,
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

  const { limit, offset, quoteId, intentId, status } = parsed.data;
  let query = admin
    .from("insurance_payments")
    .select(
      "id, quote_id, intent_id, amount, currency, status, channel, reference, recorded_at, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (quoteId) {
    query = query.eq("quote_id", quoteId);
  }

  if (intentId) {
    query = query.eq("intent_id", intentId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;
  if (error) {
    if (error.code === "42P01" || error.code === "42703") {
      return NextResponse.json({ data: [], total: 0, hasMore: false, disabled: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map(mapRow);
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return NextResponse.json({ data: rows, total, hasMore });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
