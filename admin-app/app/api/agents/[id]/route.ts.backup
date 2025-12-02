import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = await params;
  const { data, error } = await admin.from("agent_personas").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error }, { status: 404 });
  return NextResponse.json({ agent: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, summary, status, default_language, tags } = body || {};
  const patch: Record<string, unknown> = {};
  if (name) patch.name = name;
  if (typeof summary === "string") patch.summary = summary;
  if (typeof status === "string") patch.status = status;
  if (typeof default_language === "string") patch.default_language = default_language;
  if (Array.isArray(tags)) patch.tags = tags;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no_fields" }, { status: 400 });
  patch.updated_at = new Date().toISOString();
  const { data, error } = await admin.from("agent_personas").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ agent: data });
}


export const runtime = "nodejs";
