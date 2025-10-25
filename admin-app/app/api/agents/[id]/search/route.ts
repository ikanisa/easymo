import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = params;
  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const query = (body?.query ?? '').trim();
  const top_k = Number(body?.top_k ?? 8);
  if (!query) return NextResponse.json({ error: 'query_required' }, { status: 400 });
  try {
    const { data, error } = await admin.functions.invoke('agent-doc-search', { body: { agent_id: id, query, top_k } });
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ ok: true, results: (data as any)?.results ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

