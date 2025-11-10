import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const BUCKET = process.env.AGENT_DOCS_BUCKET || "agent-docs";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; docId: string } },
) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { docId } = params;
  const { data: current, error: fetchErr } = await admin
    .from("agent_documents")
    .select("id, title, metadata, embedding_status")
    .eq("id", docId)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof (body as { title?: unknown }).title === "string") {
    updates.title = (body as { title: string }).title.trim() || current.title;
  }

  if (typeof (body as { embedding_status?: unknown }).embedding_status === "string") {
    updates.embedding_status = (body as { embedding_status: string }).embedding_status;
  }

  const existingMeta = (current.metadata && typeof current.metadata === "object")
    ? (current.metadata as Record<string, unknown>)
    : {};
  const metadataUpdates: Record<string, unknown> = { ...existingMeta };
  let metadataChanged = false;

  if (Array.isArray((body as { tags?: unknown }).tags)) {
    metadataUpdates.tags = (body as { tags: unknown[] }).tags
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter((tag) => tag.length > 0);
    metadataChanged = true;
  }

  if (body && typeof (body as { metadata?: unknown }).metadata === "object" && !Array.isArray((body as { metadata?: unknown }).metadata)) {
    Object.assign(metadataUpdates, (body as { metadata: Record<string, unknown> }).metadata);
    metadataChanged = true;
  }

  if (metadataChanged) {
    updates.metadata = metadataUpdates;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const { data, error: updateErr } = await admin
    .from("agent_documents")
    .update(updates)
    .eq("id", docId)
    .select("*")
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ document: data });
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string; docId: string } },
) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, {
      status: 503,
    });
  }
  // Load row to get storage path
  const { data: doc, error: fetchErr } = await admin
    .from("agent_documents")
    .select("id, storage_path")
    .eq("id", params.docId)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (doc.storage_path) {
    await admin.storage.from(BUCKET).remove([doc.storage_path]).catch(() =>
      null
    );
  }
  const { error } = await admin.from("agent_documents").delete().eq(
    "id",
    params.docId,
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}

export const runtime = "nodejs";
