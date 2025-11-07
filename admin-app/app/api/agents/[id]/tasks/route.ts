import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = params;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  let query = admin.from("agent_tasks").select("*").eq("agent_id", id).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const type = typeof body.type === "string" ? body.type : null;
  if (!type) return NextResponse.json({ error: "type_required" }, { status: 400 });
  const payload = (typeof body.payload === "object" && body.payload) ? body.payload : {};
  const scheduled_at = typeof body.scheduled_at === "string" ? body.scheduled_at : null;
  const { data, error } = await admin
    .from("agent_tasks")
    .insert({ agent_id: id, type, payload, status: "queued", scheduled_at })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ task: data }, { status: 201 });
}

export const runtime = "nodejs";
