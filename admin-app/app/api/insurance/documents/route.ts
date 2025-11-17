import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const listParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  intentId: z.string().uuid().optional(),
  ocrState: z.string().optional(),
});

function mapRow(row: Record<string, any>) {
  return {
    id: row.id as string,
    intentId: (row.intent_id as string | null | undefined) ?? null,
    contactId: (row.contact_id as string | null | undefined) ?? null,
    kind: (row.kind as string | null) ?? "other",
    storagePath: row.storage_path as string,
    checksum: (row.checksum as string | null | undefined) ?? null,
    ocrState: (row.ocr_state as string | null) ?? "pending",
    ocrJson: row.ocr_json ?? null,
    ocrConfidence: row.ocr_confidence === undefined ? null : Number(row.ocr_confidence),
    createdAt: row.created_at as string,
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

  const { limit, offset, intentId, ocrState } = parsed.data;
  let query = admin
    .from("insurance_documents")
    .select(
      "id, intent_id, contact_id, kind, storage_path, checksum, ocr_state, ocr_json, ocr_confidence, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (intentId) {
    query = query.eq("intent_id", intentId);
  }

  if (ocrState) {
    query = query.eq("ocr_state", ocrState);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map(mapRow);
  // Enrich with contact info if available
  const contactIds = Array.from(new Set(rows.map((r) => r.contactId).filter((v): v is string => Boolean(v))));
  let contactsMap = new Map<string, { name: string | null }>();
  if (contactIds.length) {
    const { data: contacts } = await admin
      .from('wa_contacts')
      .select('id, display_name')
      .in('id', contactIds);
    (contacts ?? []).forEach((c: any) => {
      contactsMap.set(String(c.id), { name: (c.display_name as string | null) ?? null });
    });
  }
  const enriched = rows.map((r) => ({
    ...r,
    contactName: r.contactId ? (contactsMap.get(r.contactId)?.name ?? null) : null,
  }));
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return NextResponse.json({ data: enriched, total, hasMore });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
