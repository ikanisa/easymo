import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = params;
  const { data, error } = await admin.from("agent_tasks").select("*").eq("agent_id", id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const { title, payload = {}, assigned_to = null, due_at = null } = body || {};
  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  const { data, error } = await admin.from("agent_tasks").insert({ agent_id: id, title, payload, assigned_to, due_at }).select().single();
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ task: data }, { status: 201 });
}

