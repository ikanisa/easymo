import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET() {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { data, error } = await admin.from("agent_personas").select("*").order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ agents: data ?? [] });
}

export async function POST(req: Request) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const { name, summary, default_language = "en", tags = [] } = body || {};
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  const { data, error } = await admin.from("agent_personas").insert({ name, summary, default_language, tags }).select().single();
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ agent: data }, { status: 201 });
}

