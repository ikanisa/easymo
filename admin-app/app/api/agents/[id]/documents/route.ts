import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = params;
  const { data, error } = await admin.from("agent_documents").select("*").eq("agent_id", id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const { title, source_url, storage_path, metadata = {} } = body || {};
  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  const { data, error } = await admin.from("agent_documents").insert({ agent_id: id, title, source_url, storage_path, metadata }).select().single();
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ document: data }, { status: 201 });
}

