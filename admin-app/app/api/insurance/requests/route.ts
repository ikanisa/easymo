import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import type { Database } from "@/src/v2/lib/supabase/database.types";

const listParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(25),
  offset: z.coerce.number().min(0).default(0),
  status: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
});

const createRequestSchema = z.object({
  contactId: z.string().uuid().nullable().optional(),
  status: z.string().min(1).default("collecting"),
  vehicleType: z.string().min(1).nullable().optional(),
  vehiclePlate: z.string().min(1).nullable().optional(),
  insurerPreference: z.string().min(1).nullable().optional(),
  notes: z.string().min(1).nullable().optional(),
});

function mapRow(row: Record<string, any>) {
  return {
    id: row.id as string,
    contactId: (row.contact_id as string | null | undefined) ?? null,
    status: (row.status as string | null) ?? "collecting",
    vehicleType: (row.vehicle_type as string | null) ?? null,
    vehiclePlate: (row.vehicle_plate as string | null) ?? null,
    insurerPreference: (row.insurer_preference as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | null | undefined) ?? null,
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

  const { limit, offset, status, search } = parsed.data;
  let query = admin
    .from("insurance_intents" as keyof Database["public"]["Tables"]) as unknown as import("@supabase/supabase-js").PostgrestQueryBuilder<Database["public"]> // typed safeguard
  ;
  query = (query as any)
    .select(
      "id, contact_id, status, vehicle_type, vehicle_plate, insurer_preference, notes, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(
      `vehicle_plate.ilike.%${search}%,notes.ilike.%${search}%,insurer_preference.ilike.%${search}%`,
    );
  }

  const { data, error, count } = await query;

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
  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const payload = {
    contact_id: parsed.data.contactId ?? null,
    status: parsed.data.status ?? "collecting",
    vehicle_type: parsed.data.vehicleType ?? null,
    vehicle_plate: parsed.data.vehiclePlate ?? null,
    insurer_preference: parsed.data.insurerPreference ?? null,
    notes: parsed.data.notes ?? null,
  };

  const { data, error } = await admin
    .from("insurance_intents")
    .insert(payload)
    .select(
      "id, contact_id, status, vehicle_type, vehicle_plate, insurer_preference, notes, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ data: mapRow(data) }, { status: 201 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
