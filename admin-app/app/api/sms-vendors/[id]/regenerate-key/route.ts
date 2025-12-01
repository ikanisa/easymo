import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

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

export async function POST(
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

  // Generate new API key and HMAC secret
  const apiKey = randomBytes(32).toString("hex");
  const hmacSecret = randomBytes(32).toString("hex");

  const { data, error } = await admin
    .from("sms_parsing_vendors")
    .update({
      api_key: apiKey,
      hmac_secret: hmacSecret,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: mapRow(data) });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
