import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const idem = req.headers.get("Idempotency-Key") || undefined;
  try {
    const { wa_media_id, intent_id, kind, wa_media_url } = await req.json();

    // Structured log
    console.log(JSON.stringify({ evt: "insurance.ingest_media", reqId, idem, intent_id, kind, wa_media_id, wa_media_url }));

    if (!intent_id || !kind) {
      return NextResponse.json({ error: "intent_id and kind required", reqId }, { status: 400 });
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Placeholder: fetch media bytes from Meta if needed
    // const bytes = await fetchMedia(wa_media_id, wa_media_url);

    const fileName = `${intent_id}/${Date.now()}_${kind}.jpg`;
    const storage_path = `insurance_uploads/${fileName}`;

    // Optional upload step (disabled placeholder)
    // await supabase.storage.from("insurance_uploads").upload(fileName, bytes, { upsert: false });

    const checksum = "sha256:placeholder";
    const { data, error } = await supabase
      .from("insurance_documents")
      .insert([{ intent_id, contact_id: null, kind, storage_path, checksum, ocr_state: "pending" }])
      .select();

    if (error) return NextResponse.json({ error, reqId }, { status: 400 });
    return NextResponse.json({ document: data?.[0], reqId }, { status: 201 });
  } catch (err: any) {
    console.error(JSON.stringify({ evt: "insurance.ingest_media.error", reqId, message: err?.message }));
    return NextResponse.json({ error: "internal_error", reqId }, { status: 500 });
  }
}

