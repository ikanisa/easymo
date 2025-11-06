import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type OcrRequestBody = {
  document_ids?: unknown;
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

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable", reqId }, { status: 503 });
  }

  if (parsed.length > 0) {
    const { data: documents, error: docsError } = await supabase
      .from("insurance_documents")
      .select("id, storage_path, kind")
      .in("id", parsed);

    if (docsError) {
      return NextResponse.json({ error: "document_lookup_failed", reqId }, { status: 400 });
    }

    const docsById = new Map((documents ?? []).map((doc) => [doc.id, doc]));
    const missing = parsed.filter((id) => !docsById.has(id));
    if (missing.length > 0) {
      return NextResponse.json({ error: "unknown_document_ids", missing, reqId }, { status: 400 });
    }

    const missingStorage = (documents ?? []).filter((doc) => typeof doc.storage_path !== "string");
    if (missingStorage.length > 0) {
      return NextResponse.json(
        { error: "documents_missing_storage_paths", missing: missingStorage.map((doc) => doc.id), reqId },
        { status: 400 }
      );
    }

    const storagePaths = Array.from(new Set((documents ?? []).map((doc) => doc.storage_path as string)));

    const { data: queueRows, error: queueFetchError } = await supabase
      .from("insurance_media_queue")
      .select("id, storage_path, status")
      .in("storage_path", storagePaths);

    if (queueFetchError) {
      return NextResponse.json({ error: "queue_lookup_failed", reqId }, { status: 500 });
    }

    const queueByPath = new Map((queueRows ?? []).map((row) => [row.storage_path, row]));

    const pathsNeedingInsert = storagePaths.filter((path) => !queueByPath.has(path));
    if (pathsNeedingInsert.length > 0) {
      const payload = pathsNeedingInsert.map((path) => {
        const doc = documents?.find((item) => item.storage_path === path);
        return {
          storage_path: path,
          mime_type: null,
          caption: doc?.kind ?? null,
          status: "queued",
        };
      });
      const { error: queueInsertError } = await supabase.from("insurance_media_queue").insert(payload);
      if (queueInsertError) {
        return NextResponse.json({ error: "queue_insert_failed", reqId }, { status: 500 });
      }
    }

    const pathsNeedingReset = storagePaths.filter((path) => {
      const status = queueByPath.get(path)?.status;
      return status === "retry" || status === "failed";
    });
    if (pathsNeedingReset.length > 0) {
      const { error: queueResetError } = await supabase
        .from("insurance_media_queue")
        .update({ status: "queued", last_error: null, processed_at: null })
        .in("storage_path", pathsNeedingReset);
      if (queueResetError) {
        return NextResponse.json({ error: "queue_reset_failed", reqId }, { status: 500 });
      }
    }
  }

  // Trigger the insurance-ocr worker to process the queue (document_ids re-queued above when provided).
  try {
    const payload = parsed.length > 0 ? { document_ids: parsed } : {};
    const { data, error } = await supabase.functions.invoke('insurance-ocr', { body: payload });
    if (error) return NextResponse.json({ error, reqId }, { status: 500 });
    return NextResponse.json({ ok: true, result: data, reqId, idempotencyKey }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e), reqId }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const enabled = (process.env.API_HEALTH_PROBES_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const reqId = req.headers.get("x-request-id") || undefined;
  return NextResponse.json({ route: "insurance.ocr", status: "ok", reqId }, { status: 200 });
}

export const runtime = "edge";
