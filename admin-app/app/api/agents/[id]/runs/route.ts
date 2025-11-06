import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = params;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  let query = admin.from("agent_runs").select("*").eq("agent_id", id).order("started_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ runs: data ?? [] });
}


export const runtime = "edge";
