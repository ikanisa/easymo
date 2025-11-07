import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type Body = { document_ids?: unknown };

export async function POST(req: NextRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const raw = body?.document_ids;
  if (!Array.isArray(raw)) return NextResponse.json({ error: 'invalid_document_ids' }, { status: 400 });
  const ids = raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  if (!ids.length) return NextResponse.json({ queued: 0 }, { status: 200 });
  // Load documents to determine storage_path and kind
  const { data, error } = await admin.from('insurance_documents').select('id, storage_path, kind').in('id', ids);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const rows = (data ?? []).map((d: any) => {
    // Infer mime-type from extension when not present
    let mime: string | null = null;
    const path: string = d.storage_path || '';
    if (/\.jpe?g$/i.test(path)) mime = 'image/jpeg';
    else if (/\.png$/i.test(path)) mime = 'image/png';
    else if (/\.webp$/i.test(path)) mime = 'image/webp';
    else if (/\.pdf$/i.test(path)) mime = 'application/pdf';
    const caption = typeof d.kind === 'string' && d.kind.length ? d.kind : null;
    return {
      profile_id: null,
      wa_id: null,
      storage_path: d.storage_path,
      mime_type: mime,
      caption,
      status: 'queued',
    };
  });
  if (rows.length) {
    await admin.from('insurance_media_queue').insert(rows);
  }
  return NextResponse.json({ queued: rows.length }, { status: 200 });
}

export const runtime = "nodejs";
