import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const idem = req.headers.get("Idempotency-Key") || undefined;
  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { document_ids } = await req.json();

    console.log(JSON.stringify({ evt: "insurance.ocr", reqId, idem, count: Array.isArray(document_ids) ? document_ids.length : 0 }));

    const mockExtract = { policy: { insurer: "PLACEHOLDER", policy_number: "POL-123" }, confidence: 0.85 };

    if (Array.isArray(document_ids) && document_ids.length) {
      const updates = document_ids.map((id: string) =>
        supabase
          .from("insurance_documents")
          .update({ ocr_state: "done", ocr_json: mockExtract as any, ocr_confidence: mockExtract.confidence })
          .eq("id", id)
      );
      await Promise.all(updates);
    }

    return NextResponse.json({ extracts: Array.isArray(document_ids) ? document_ids.length : 0, reqId }, { status: 200 });
  } catch (err: any) {
    console.error(JSON.stringify({ evt: "insurance.ocr.error", reqId, message: err?.message }));
    return NextResponse.json({ error: "internal_error", reqId }, { status: 500 });
  }
}

