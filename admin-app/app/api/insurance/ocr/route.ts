import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  const idem = req.headers.get("Idempotency-Key") || undefined;
  const { document_ids } = await req.json();
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable", reqId }, { status: 503 });
}

export async function GET(req: NextRequest) {
  const enabled = (process.env.API_HEALTH_PROBES_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const reqId = req.headers.get("x-request-id") || undefined;
  return NextResponse.json({ route: "insurance.ocr", status: "ok", reqId }, { status: 200 });
}

  // Placeholder OCR: replace with LLM vision or Tesseract call
  const extract = { policy: { insurer: "PLACEHOLDER", policy_number: "POL-123" }, vehicle: { plate: "RAB123C" }, confidence: 0.85 };

  await Promise.all(
    (document_ids || []).map((id: string) =>
      supabase
        .from("insurance_documents")
        .update({ ocr_state: "done", ocr_json: extract, ocr_confidence: extract.confidence })
        .eq("id", id)
    )
  );
  return NextResponse.json({ processed: (document_ids || []).length, reqId, idempotencyKey: idem }, { status: 200 });
}
