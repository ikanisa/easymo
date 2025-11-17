import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const STATUS_COMPLETES = new Set(["completed", "failed", "stopped", "dry_run"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params;
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { status, payload, note } = body as {
    status?: string;
    payload?: Record<string, unknown>;
    note?: string;
  };

  const updates: Record<string, unknown> = {};

  if (typeof status === "string") {
    updates.status = status;
    if (status === "running") {
      updates.started_at = new Date().toISOString();
      updates.completed_at = null;
      updates.error = null;
    } else if (STATUS_COMPLETES.has(status)) {
      updates.completed_at = new Date().toISOString();
    }
  }

  if (payload && typeof payload === "object") {
    updates.payload = payload;
  }

  if (typeof note === "string") {
    updates.error = note.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("agent_tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("agent_id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ task: data });
}

export const runtime = "nodejs";
