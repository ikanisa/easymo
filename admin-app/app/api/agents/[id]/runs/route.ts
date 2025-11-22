import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = await params;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(200, Number.parseInt(limitParam, 10) || 0)) : 100;
  let query = admin
    .from("agent_runs")
    .select("*")
    .eq("agent_id", id)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ runs: data ?? [] });
}


export const runtime = "nodejs";
