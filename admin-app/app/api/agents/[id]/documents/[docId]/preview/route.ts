import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { docId } = await params;
  const ttl = Number(new URL(req.url).searchParams.get('ttl') ?? '300');
  const { data: doc, error } = await admin.from('agent_documents').select('id, storage_path, source_url').eq('id', docId).maybeSingle();
  if (error || !doc) return NextResponse.json({ error: error ?? 'not_found' }, { status: 404 });
  const accept = req.headers.get('accept') ?? '';
  const wantsHtml = accept.includes('text/html');
  if (doc.storage_path) {
    const { data: signed, error: signErr } = await admin.storage.from('agent-docs').createSignedUrl(doc.storage_path, Math.max(60, Math.min(ttl, 3600)));
    if (signErr || !signed?.signedUrl) return NextResponse.json({ error: signErr ?? 'sign_failed' }, { status: 500 });
    if (wantsHtml) return NextResponse.redirect(signed.signedUrl, 302);
    return NextResponse.json({ url: signed.signedUrl });
  }
  if (doc.source_url) {
    if (wantsHtml) return NextResponse.redirect(doc.source_url, 302);
    return NextResponse.json({ url: doc.source_url });
  }
  return NextResponse.json({ error: 'no_preview_available' }, { status: 404 });
}

export const runtime = "nodejs";
