import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof (body as { enabled?: unknown }).enabled === "boolean") {
    updates.enabled = (body as { enabled: boolean }).enabled;
  }
  if (typeof (body as { description?: unknown }).description === "string") {
    updates.description = (body as { description: string }).description.trim();
  }
  if (body && typeof (body as { parameters?: unknown }).parameters === "object") {
    updates.parameters = (body as { parameters: Record<string, unknown> }).parameters;
  }
  if (body && typeof (body as { metadata?: unknown }).metadata === "object") {
    updates.metadata = (body as { metadata: Record<string, unknown> }).metadata;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await admin
    .from("agent_tools")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ tool: data });
}

export const runtime = "nodejs";
