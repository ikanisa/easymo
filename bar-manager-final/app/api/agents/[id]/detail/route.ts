import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type PersonaRow = {
  id: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
};

type VersionRow = {
  id: string;
  agent_id: string;
  version: number;
  created_at?: string;
  [key: string]: unknown;
};

type DocumentRow = {
  id: string;
  agent_id: string;
  created_at?: string;
  embedding_status?: string | null;
  [key: string]: unknown;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = await params;

  try {
    const agentResPromise = admin.from("agent_personas").select("*").eq("id", id).maybeSingle();
    const versionsResPromise = admin
      .from("agent_versions")
      .select("*")
      .eq("agent_id", id)
      .order("version", { ascending: false });
    const docsResPromise = admin
      .from("agent_documents")
      .select("*")
      .eq("agent_id", id)
      .order("created_at", { ascending: false });

    const [agentRes, versionsRes, docsRes] = await Promise.all([
      agentResPromise,
      versionsResPromise,
      docsResPromise,
    ]);

    const agentErr = agentRes?.error; const versionsErr = versionsRes?.error; const docsErr = docsRes?.error;
    if (agentErr) return NextResponse.json({ error: agentErr }, { status: 404 });
    if (versionsErr) return NextResponse.json({ error: versionsErr }, { status: 400 });
    if (docsErr) return NextResponse.json({ error: docsErr }, { status: 400 });

    const agent = agentRes?.data ?? null;
    const versions = versionsRes?.data ?? [] as VersionRow[];
    const documents = (docsRes?.data ?? []) as DocumentRow[];

    // Vector stats (reuse logic from stats route)
    const docIds = documents.map((d) => d.id);
    let jsonChunks = 0, vecChunks = 0;
    if (docIds.length) {
      const { count: c1 } = await admin.from('agent_document_embeddings').select('document_id', { count: 'exact', head: true }).in('document_id', docIds);
      jsonChunks = c1 ?? 0;
      const { count: c2 } = await admin.from('agent_document_vectors').select('document_id', { count: 'exact', head: true }).in('document_id', docIds);
      vecChunks = c2 ?? 0;
    }
    const totalDocs = documents.length;
    const readyDocs = documents.filter((d) => d.embedding_status === 'ready').length;
    const vectorStats = { totalDocs, readyDocs, jsonChunks, vecChunks };

    return NextResponse.json({ agent, versions, documents, vectorStats });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}


export const runtime = "nodejs";
