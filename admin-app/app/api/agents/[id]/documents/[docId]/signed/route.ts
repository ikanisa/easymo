import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const BUCKET = process.env.AGENT_DOCS_BUCKET || "agent-docs";

export async function GET(_: Request, context: { params: Promise<{ id: string; docId: string }> }) {
  const { docId } = await context.params;
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { data: doc, error } = await admin
    .from("agent_documents")
    .select("storage_path")
    .eq("id", docId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!doc?.storage_path) return NextResponse.json({ error: "no_storage_path" }, { status: 404 });
  const { data: signed, error: signErr } = await admin.storage.from(BUCKET).createSignedUrl(doc.storage_path, 3600);
  if (signErr) return NextResponse.json({ error: signErr.message }, { status: 500 });
  return NextResponse.json({ url: signed?.signedUrl ?? null });
}


export const runtime = "nodejs";
