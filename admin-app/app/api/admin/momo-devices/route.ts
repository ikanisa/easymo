import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("per_page") || "20");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  let query = supabase
    .from("momo_devices")
    .select(`
      *,
      merchant:profiles!merchant_id(id, phone, full_name)
    `, { count: "exact" });

  if (status) query = query.eq("status", status);
  if (search) query = query.or(`device_id.ilike.%${search}%,device_name.ilike.%${search}%`);

  const { data, count, error } = await query
    .order("last_seen_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    devices: data,
    total: count || 0,
    page,
    per_page: perPage,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { device_id, merchant_id, device_name, country_code } = body;

  if (!device_id) {
    return NextResponse.json({ error: "device_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("momo_devices")
    .upsert({
      device_id,
      merchant_id,
      device_name,
      country_code: country_code || "RW",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
