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
  // Allow JSON posting of remote source (source_url) as a simple path
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const title = typeof body.title === "string" ? body.title : null;
  const source_url = typeof body.source_url === "string" ? body.source_url : null;
  const storage_path = typeof body.storage_path === "string" ? body.storage_path : null;
  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  const rawStatus = (body as { embedding_status?: unknown }).embedding_status;
  const embedding_status = typeof rawStatus === "string" ? rawStatus : "pending";
  const insert = {
    agent_id: id,
    title,
    source_url,
    storage_path,
    embedding_status,
  } as Record<string, unknown>;
  const { data, error } = await admin.from("agent_documents").insert(insert).select("*").single();
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ document: data }, { status: 201 });
}

export const runtime = "edge";
