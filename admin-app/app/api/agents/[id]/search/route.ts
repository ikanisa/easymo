import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = await params;
  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const obj = (body && typeof body === 'object' ? body as Record<string, unknown> : {});
  const query = String(obj?.query ?? '').trim();
  const top_k = Number(obj?.top_k ?? 8);
  if (!query) return NextResponse.json({ error: 'query_required' }, { status: 400 });
  try {
    const { data, error } = await admin.functions.invoke('agent-doc-search', { body: { agent_id: id, query, top_k } });
    if (error) return NextResponse.json({ error }, { status: 500 });
    const results = (data && typeof data === 'object' && 'results' in (data as Record<string, unknown>))
      ? (data as { results?: unknown[] }).results ?? []
      : [];
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}


export const runtime = "nodejs";
