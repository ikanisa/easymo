import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const listParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  status: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
});

const createVendorSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required"),
  payeeMomoNumber: z.string().min(1, "Payee MoMo number is required"),
  whatsappE164: z.string().min(1, "WhatsApp number is required"),
  notes: z.string().optional(),
});

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    vendorName: row.vendor_name as string,
    payeeMomoNumber: row.payee_momo_number as string,
    whatsappE164: row.whatsapp_e164 as string,
    terminalDeviceId: (row.terminal_device_id as string | null) ?? null,
    subscriptionStatus: (row.subscription_status as string) ?? "pending",
    subscriptionStartedAt: (row.subscription_started_at as string | null) ?? null,
    subscriptionExpiresAt: (row.subscription_expires_at as string | null) ?? null,
    apiKey: row.api_key as string,
    hmacSecret: row.hmac_secret as string,
    webhookUrl: (row.webhook_url as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    activatedAt: (row.activated_at as string | null) ?? null,
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
    .from("sms_parsing_vendors")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("subscription_status", status);
  }

  if (search) {
    query = query.or(`vendor_name.ilike.%${search}%,payee_momo_number.ilike.%${search}%,whatsapp_e164.ilike.%${search}%`);
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

  const parsed = createVendorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  // Generate API key and HMAC secret (32 bytes hex = 64 characters)
  const apiKey = randomBytes(32).toString("hex");
  const hmacSecret = randomBytes(32).toString("hex");

  const payload = {
    vendor_name: parsed.data.vendorName,
    payee_momo_number: parsed.data.payeeMomoNumber,
    whatsapp_e164: parsed.data.whatsappE164,
    notes: parsed.data.notes ?? null,
    api_key: apiKey,
    hmac_secret: hmacSecret,
    subscription_status: "pending",
  };

  const { data, error } = await admin
    .from("sms_parsing_vendors")
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "duplicate_payee_number", message: "A vendor with this payee MoMo number already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: mapRow(data) }, { status: 201 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
