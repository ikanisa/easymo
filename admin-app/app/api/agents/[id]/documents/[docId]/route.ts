import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const BUCKET = process.env.AGENT_DOCS_BUCKET || "agent-docs";

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
