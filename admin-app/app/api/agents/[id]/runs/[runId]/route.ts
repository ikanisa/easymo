import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(_: Request, { params }: { params: { id: string; runId: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { data, error } = await admin
    .from("agent_runs")
    .select("*")
    .eq("id", params.runId)
    .maybeSingle();
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ run: data });
}

