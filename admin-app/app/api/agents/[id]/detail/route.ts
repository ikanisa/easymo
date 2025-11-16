import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = await params;

  try {
    const [agentRes, versionsRes, docsRes] = await Promise.all([
      admin.from("agent_personas").select("*").eq("id", id).maybeSingle(),
      admin.from("agent_versions").select("*").eq("agent_id", id).order("version", { ascending: false }),
      admin.from("agent_documents").select("*").eq("agent_id", id).order("created_at", { ascending: false }),
    ]);

    const agentErr = (agentRes as any)?.error; const versionsErr = (versionsRes as any)?.error; const docsErr = (docsRes as any)?.error;
    if (agentErr) return NextResponse.json({ error: agentErr }, { status: 404 });
    if (versionsErr) return NextResponse.json({ error: versionsErr }, { status: 400 });
    if (docsErr) return NextResponse.json({ error: docsErr }, { status: 400 });

    const agent = (agentRes as any)?.data ?? null;
    const versions = (versionsRes as any)?.data ?? [];
    const documents = (docsRes as any)?.data ?? [];

    // Vector stats (reuse logic from stats route)
    const docIds = documents.map((d: any) => d.id);
    let jsonChunks = 0, vecChunks = 0;
    if (docIds.length) {
      const { count: c1 } = await admin.from('agent_document_embeddings').select('document_id', { count: 'exact', head: true }).in('document_id', docIds);
      jsonChunks = c1 ?? 0;
      const { count: c2 } = await admin.from('agent_document_vectors').select('document_id', { count: 'exact', head: true }).in('document_id', docIds);
      vecChunks = c2 ?? 0;
    }
    const totalDocs = documents.length;
    const readyDocs = documents.filter((d: any) => d.embedding_status === 'ready').length;
    const vectorStats = { totalDocs, readyDocs, jsonChunks, vecChunks };

    return NextResponse.json({ agent, versions, documents, vectorStats });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


export const runtime = "nodejs";
