import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(_: Request, context: { params: Promise<{ id: string; runId: string }> }) {
  const { runId } = await context.params;
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { data, error } = await admin
    .from("agent_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ run: data });
}


export const runtime = "nodejs";
