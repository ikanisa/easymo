import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = params;
  let includeReady = false;
  try {
    const body = await req.json();
    includeReady = Boolean(body?.include_ready);
  } catch {
    // ignore, default false
  }
  const sel = includeReady ? '*' : "*";
  const { data, error } = await admin
    .from('agent_documents')
    .select(sel)
    .eq('agent_id', id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error }, { status: 400 });
  const docs = (data ?? []).filter((d: any) => includeReady || d.embedding_status !== 'ready');
  let ok = 0, fail = 0;
  for (const d of docs) {
    try {
      const { error: fnErr } = await admin.functions.invoke('agent-doc-embed', { body: { document_id: d.id } });
      if (fnErr) fail++; else ok++;
    } catch { fail++; }
  }
  return NextResponse.json({ ok, fail, total: docs.length });
}


export const runtime = "edge";
