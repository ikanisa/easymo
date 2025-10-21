import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type OcrRequestBody = {
  document_ids?: unknown;
};

type PlaceholderExtraction = {
  policy: { insurer: string; policy_number: string };
  vehicle: { plate: string };
  confidence: number;
};

function parseDocumentIds(body: OcrRequestBody): string[] | { error: string } {
  const { document_ids: raw } = body;

  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return { error: "invalid_document_ids" };

  const documentIds = raw.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (documentIds.length !== raw.length) {
    return { error: "invalid_document_ids" };
  }

  return documentIds;
}

function placeholderExtract(): PlaceholderExtraction {
  return {
    policy: { insurer: "PLACEHOLDER", policy_number: "POL-123" },
    vehicle: { plate: "RAB123C" },
    confidence: 0.85,
  };
}

export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  const idempotencyKey = req.headers.get("Idempotency-Key") || undefined;

  let body: OcrRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", reqId }, { status: 400 });
  }

  const parsed = parseDocumentIds(body);
  if (!Array.isArray(parsed)) {
    return NextResponse.json({ error: parsed.error, reqId }, { status: 400 });
  }

  if (parsed.length === 0) {
    return NextResponse.json({ processed: 0, reqId, idempotencyKey }, { status: 200 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable", reqId }, { status: 503 });
  }

  const extract = placeholderExtract();

  await Promise.all(
    parsed.map((id) =>
      supabase
        .from("insurance_documents")
        .update({
          ocr_state: "done",
          ocr_json: extract,
          ocr_confidence: extract.confidence,
        })
        .eq("id", id)
    )
  );

  return NextResponse.json(
    { processed: parsed.length, reqId, idempotencyKey },
    { status: 200 }
  );
}

export async function GET(req: NextRequest) {
  const enabled = (process.env.API_HEALTH_PROBES_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const reqId = req.headers.get("x-request-id") || undefined;
  return NextResponse.json({ route: "insurance.ocr", status: "ok", reqId }, { status: 200 });
}
