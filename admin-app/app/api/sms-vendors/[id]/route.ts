import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const updateVendorSchema = z.object({
  vendorName: z.string().min(1).optional(),
  payeeMomoNumber: z.string().min(1).optional(),
  whatsappE164: z.string().min(1).optional(),
  subscriptionStatus: z.enum(["pending", "active", "suspended", "expired"]).optional(),
  notes: z.string().nullable().optional(),
  webhookUrl: z.string().url().nullable().optional(),
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

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const { data, error } = await admin
    .from("sms_parsing_vendors")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: mapRow(data) });
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = updateVendorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const updates: Record<string, unknown> = {};
  
  if (parsed.data.vendorName !== undefined) {
    updates.vendor_name = parsed.data.vendorName;
  }
  if (parsed.data.payeeMomoNumber !== undefined) {
    updates.payee_momo_number = parsed.data.payeeMomoNumber;
  }
  if (parsed.data.whatsappE164 !== undefined) {
    updates.whatsapp_e164 = parsed.data.whatsappE164;
  }
  if (parsed.data.subscriptionStatus !== undefined) {
    updates.subscription_status = parsed.data.subscriptionStatus;
    // Set activated_at when status changes to active
    if (parsed.data.subscriptionStatus === "active") {
      updates.activated_at = new Date().toISOString();
      updates.subscription_started_at = new Date().toISOString();
    }
  }
  if (parsed.data.notes !== undefined) {
    updates.notes = parsed.data.notes;
  }
  if (parsed.data.webhookUrl !== undefined) {
    updates.webhook_url = parsed.data.webhookUrl;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("sms_parsing_vendors")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (error.code === "23505") {
      return NextResponse.json({ error: "duplicate_payee_number", message: "A vendor with this payee MoMo number already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: mapRow(data) });
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const { error } = await admin
    .from("sms_parsing_vendors")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
