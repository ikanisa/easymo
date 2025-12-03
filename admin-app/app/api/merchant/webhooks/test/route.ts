import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";

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

export async function POST() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: config, error } = await supabase
    .from("merchant_webhook_configs")
    .select("*")
    .eq("merchant_id", user.id)
    .single();

  if (error || !config) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  // Create test payload
  const testPayload = {
    event: "test",
    timestamp: new Date().toISOString(),
    data: {
      message: "This is a test webhook from EasyMO",
      merchant_id: user.id,
    },
  };

  const payloadStr = JSON.stringify(testPayload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac("sha256", config.hmac_secret)
    .update(`${timestamp}.${payloadStr}`)
    .digest("hex");

  const startTime = Date.now();
  let statusCode = 0;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(config.endpoint_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Momo-Signature": signature,
        "X-Momo-Timestamp": timestamp,
      },
      body: payloadStr,
    });
    statusCode = response.status;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  const responseTime = Date.now() - startTime;

  // Log delivery
  await supabase.from("webhook_delivery_log").insert({
    config_id: config.id,
    event_type: "test",
    status_code: statusCode,
    response_time_ms: responseTime,
    error_message: errorMessage,
  });

  return NextResponse.json({
    success: statusCode >= 200 && statusCode < 300,
    status_code: statusCode,
    response_time_ms: responseTime,
    error: errorMessage,
  });
}
