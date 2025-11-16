import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = await params;
  const maxPerHour = Number(process.env.AGENT_DOCS_IMPORT_MAX_PER_HOUR || '0') || 0;
  const maxPerDay = Number(process.env.AGENT_DOCS_IMPORT_MAX_PER_DAY || '0') || 0;
  if (maxPerHour > 0) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('agent_documents').select('id', { count: 'exact', head: true }).eq('agent_id', id).gte('created_at', since);
    if ((count ?? 0) >= maxPerHour) {
      return NextResponse.json({ error: 'rate_limited', limit: maxPerHour }, { status: 429 });
    }
  }
  if (maxPerDay > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('agent_documents').select('id', { count: 'exact', head: true }).eq('agent_id', id).gte('created_at', since);
    if ((count ?? 0) >= maxPerDay) {
      return NextResponse.json({ error: 'rate_limited_daily', limit: maxPerDay }, { status: 429 });
    }
  }
  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const title = (body?.title ?? '').trim();
  const url = (body?.url ?? '').trim();
  if (!url) return NextResponse.json({ error: 'url_required' }, { status: 400 });
  // Duplicate pre-check
  const { data: existing } = await admin
    .from('agent_documents')
    .select('id,title,source_url,created_at,embedding_status')
    .eq('agent_id', id)
    .eq('source_url', url)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ document: existing, duplicate: true }, { status: 200 });
  }
  const { data, error } = await admin
    .from('agent_documents')
    .insert({ agent_id: id, title: title || url, source_url: url, embedding_status: 'pending' })
    .select()
    .single();
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ document: data, duplicate: false }, { status: 201 });
}

export const runtime = "nodejs";
