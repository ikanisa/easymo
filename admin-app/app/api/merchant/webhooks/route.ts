import { createServerClient } from "@supabase/ssr";
import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
}

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("merchant_webhook_configs")
    .select("id, endpoint_url, events, is_active, last_delivery_at, delivery_success_count, delivery_failure_count, created_at")
    .eq("merchant_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get recent deliveries
  let deliveries: unknown[] = [];
  if (data) {
    const { data: logs } = await supabase
      .from("webhook_delivery_log")
      .select("*")
      .eq("config_id", data.id)
      .order("created_at", { ascending: false })
      .limit(10);
    deliveries = logs || [];
  }

  return NextResponse.json({ config: data || null, recent_deliveries: deliveries });
}

export async function PUT(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint_url, events, is_active, regenerate_secret } = body;

  // Check if config exists
  const { data: existing } = await supabase
    .from("merchant_webhook_configs")
    .select("id, hmac_secret")
    .eq("merchant_id", user.id)
    .single();

  const hmacSecret = regenerate_secret || !existing
    ? crypto.randomBytes(32).toString("hex")
    : existing.hmac_secret;

  const configData = {
    merchant_id: user.id,
    endpoint_url,
    events: events || ["payment_received", "payment_sent"],
    is_active: is_active ?? true,
    hmac_secret: hmacSecret,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = existing
    ? await supabase
        .from("merchant_webhook_configs")
        .update(configData)
        .eq("id", existing.id)
        .select("id, endpoint_url, events, is_active, created_at")
        .single()
    : await supabase
        .from("merchant_webhook_configs")
        .insert(configData)
        .select("id, endpoint_url, events, is_active, created_at")
        .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ...data,
    hmac_secret: regenerate_secret || !existing ? hmacSecret : undefined,
  });
}
