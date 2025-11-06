import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const idem = req.headers.get("Idempotency-Key") || undefined;
  const { wa_media_id, wa_media_url, intent_id, kind } = await req.json();

  // If WhatsApp media id provided, fetch via edge function and upload to storage

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable", reqId }, { status: 503 });
  }
  const objectPath = `${intent_id}/${Date.now()}_${kind || "other"}.bin`;

  if (wa_media_id) {
    try {
      const { error: fnErr } = await supabase.functions.invoke('insurance-media-fetch', { body: { media_id: wa_media_id, object_path: objectPath } });
      if (fnErr) return NextResponse.json({ error: fnErr, reqId }, { status: 502 });
    } catch (e: any) {
      return NextResponse.json({ error: String(e?.message || e), reqId }, { status: 502 });
    }
  }

  const storage_path = `insurance_uploads/${objectPath}`;
  const checksum = "sha256:placeholder";
  const { data, error } = await supabase
    .from("insurance_documents")
    .insert([{ intent_id, kind, storage_path, checksum, ocr_state: "pending" }])
    .select()
    .single();

  if (error) return NextResponse.json({ error, reqId }, { status: 400 });

  // Also enqueue for OCR worker (if table exists)
  try {
    await supabase.from('insurance_media_queue').insert({
      profile_id: null,
      wa_id: null,
      storage_path,
      mime_type: 'image/jpeg',
      caption: kind || 'other',
      status: 'queued',
    });
  } catch (_) {
    // non-blocking
  }

  return NextResponse.json({ document: data, reqId, idempotencyKey: idem }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const enabled = (process.env.API_HEALTH_PROBES_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  return NextResponse.json({ route: "insurance.ingest_media", status: "ok", reqId }, { status: 200 });
}

export const runtime = "edge";
