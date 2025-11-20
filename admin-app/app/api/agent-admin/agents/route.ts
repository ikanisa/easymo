import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(_req: NextRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });

  const { data, error } = await admin
    .from("agent_configurations")
    .select("agent_type, primary_provider, fallback_provider, provider_config, is_active, updated_at, updated_by")
    .order("agent_type", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ agents: data ?? [] });
}
