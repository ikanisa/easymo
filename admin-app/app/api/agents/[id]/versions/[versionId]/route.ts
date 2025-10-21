import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function PATCH(req: Request, { params }: { params: { id: string; versionId: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { versionId } = params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.instructions === "string") patch.instructions = body.instructions;
  if (body.tools) patch.tools = body.tools;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no_fields" }, { status: 400 });
  const { data, error } = await admin.from("agent_versions").update(patch).eq("id", versionId).select().single();
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ version: data });
}

