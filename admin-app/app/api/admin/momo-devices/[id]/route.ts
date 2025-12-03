import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: device, error } = await supabase
    .from("momo_devices")
    .select(`*, merchant:profiles!merchant_id(id, phone, full_name)`)
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Get recent transactions
  const { data: transactions } = await supabase
    .from("momo_transactions")
    .select("id, amount, provider, status, created_at")
    .eq("device_id", device.device_id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Get webhook delivery stats
  const { data: deliveryStats } = await supabase
    .from("webhook_delivery_log")
    .select("status_code")
    .eq("config_id", device.merchant_id);

  const stats = {
    total: deliveryStats?.length || 0,
    successful: deliveryStats?.filter((d) => d.status_code >= 200 && d.status_code < 300).length || 0,
    failed: deliveryStats?.filter((d) => !d.status_code || d.status_code >= 400).length || 0,
  };

  return NextResponse.json({ device, recent_transactions: transactions || [], webhook_delivery_stats: stats });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status, device_name } = body;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (device_name) updates.device_name = device_name;

  const { data, error } = await supabase
    .from("momo_devices")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
