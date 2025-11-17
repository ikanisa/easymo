import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const listParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  quoteId: z.string().uuid().optional(),
  status: z.string().optional(),
});

function mapRow(row: Record<string, any>) {
  return {
    id: row.id as string,
    quoteId: (row.quote_id as string | null | undefined) ?? null,
    policyNumber: (row.policy_number as string | null) ?? "",
    status: (row.status as string | null) ?? "draft",
    insurer: (row.insurer as string | null) ?? null,
    premium: row.premium === null || row.premium === undefined
      ? null
      : typeof row.premium === "number"
      ? row.premium
      : Number(row.premium),
    currency: (row.currency as string | null) ?? null,
    effectiveAt: (row.effective_at as string | null | undefined) ?? null,
    expiresAt: (row.expires_at as string | null | undefined) ?? null,
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

  const { limit, offset, quoteId, status } = parsed.data;
  let query = admin
    .from("insurance_policies")
    .select(
      "id, quote_id, policy_number, status, insurer, premium, currency, effective_at, expires_at, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (quoteId) {
    query = query.eq("quote_id", quoteId);
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
  const quoteIds = Array.from(new Set(rows.map((r) => r.quoteId).filter((v): v is string => Boolean(v))));
  let quotes: Array<Record<string, any>> = [];
  let hadQuoteError = false;
  if (quoteIds.length) {
    let qr = await admin
      .from("insurance_quotes")
      .select("id, user_id, intent_id")
      .in("id", quoteIds);
    if (qr.error && (qr.error.code === "42703" || (qr.error.message || "").includes("intent_id"))) {
      hadQuoteError = true;
      const qr2 = await admin
        .from("insurance_quotes")
        .select("id, user_id")
        .in("id", quoteIds);
      quotes = qr2.data ?? [];
    } else {
      quotes = qr.data ?? [];
    }
  }
  const quoteById = new Map<string, any>();
  quotes.forEach((q: any) => quoteById.set(String(q.id), q));

  const intentIds = Array.from(
    new Set(
      quotes
        .map((q: any) => q.intent_id as string | null | undefined)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  let intentsMap = new Map<string, { plate: string | null; contactId: string | null }>();
  if (intentIds.length) {
    const { data: intents } = await admin
      .from("insurance_intents")
      .select("id, vehicle_plate, contact_id")
      .in("id", intentIds);
    (intents ?? []).forEach((it: any) =>
      intentsMap.set(String(it.id), {
        plate: (it.vehicle_plate as string | null) ?? null,
        contactId: (it.contact_id as string | null) ?? null,
      }),
    );
  }
  const contactIds = Array.from(
    new Set(
      Array.from(intentsMap.values())
        .map((v) => v.contactId)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const userIds = Array.from(
    new Set(
      quotes.map((q: any) => q.user_id as string | null | undefined).filter((v): v is string => Boolean(v)),
    ),
  );
  let contactMap = new Map<string, { name: string | null; phone: string | null }>();
  if (contactIds.length) {
    const { data: contacts } = await admin
      .from("wa_contacts")
      .select("id, display_name, phone_e164")
      .in("id", contactIds);
    (contacts ?? []).forEach((c: any) =>
      contactMap.set(String(c.id), { name: (c.display_name as string | null) ?? null, phone: (c.phone_e164 as string | null) ?? null }),
    );
  }
  let profileMap = new Map<string, { name: string | null }>();
  if (userIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);
    (profiles ?? []).forEach((p: any) =>
      profileMap.set(String(p.user_id), { name: (p.display_name as string | null) ?? null }),
    );
  }

  const enriched = rows.map((p) => {
    const q = p.quoteId ? quoteById.get(p.quoteId) : null;
    const intentId = q?.intent_id as string | null | undefined;
    const intent = intentId ? intentsMap.get(intentId) : undefined;
    const vehiclePlate = intent?.plate ?? null;
    const contact = intent?.contactId ? contactMap.get(intent.contactId) ?? null : null;
    const contactName = contact?.name ?? null;
    const contactPhone = contact?.phone ?? null;
    const profileName = q?.user_id ? profileMap.get(String(q.user_id))?.name ?? null : null;
    return {
      ...p,
      vehiclePlate,
      customerName: contactName ?? profileName ?? null,
      customerPhone: contactPhone ?? null,
    };
  });

  const total = count ?? enriched.length;
  const hasMore = offset + enriched.length < total;
  return NextResponse.json({ data: enriched, total, hasMore });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
