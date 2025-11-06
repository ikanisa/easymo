import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = params;
  const { data, error } = await admin.from("agent_versions").select("*").eq("agent_id", id).order("version", { ascending: false });
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ versions: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const { instructions = "", tools = {}, version } = body || {};
  const ver = typeof version === "number" ? version : Date.now();
  const { data, error } = await admin.from("agent_versions").insert({ agent_id: id, version: ver, instructions, tools }).select().single();
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ version: data }, { status: 201 });
}


export const runtime = "edge";
