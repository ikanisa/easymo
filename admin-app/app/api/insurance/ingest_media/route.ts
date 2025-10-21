import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const idem = req.headers.get("Idempotency-Key") || undefined;
  const { wa_media_id, wa_media_url, intent_id, kind } = await req.json();

  // TODO: fetch bytes securely from WA Graph (wa_media_id or wa_media_url)
  // const bytes = await fetchFromMeta(wa_media_id ?? wa_media_url);

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable", reqId }, { status: 503 });
  }
  const fileKey = `${intent_id}/${Date.now()}_${kind || "other"}.jpg`;

  // const { error: upErr } = await supabase.storage.from('insurance_uploads').upload(fileKey, bytes, { upsert: false });
  // if (upErr) return NextResponse.json({ error: upErr, reqId }, { status: 400 });

  const storage_path = `insurance_uploads/${fileKey}`;
  const checksum = "sha256:placeholder";
  const { data, error } = await supabase
    .from("insurance_documents")
    .insert([{ intent_id, kind, storage_path, checksum, ocr_state: "pending" }])
    .select()
    .single();

  if (error) return NextResponse.json({ error, reqId }, { status: 400 });
  return NextResponse.json({ document: data, reqId, idempotencyKey: idem }, { status: 201 });
}
