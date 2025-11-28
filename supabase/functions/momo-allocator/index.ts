import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import {
  buildNumberLookupCandidates,
  normalizeE164,
} from "../_shared/phone.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";

const BATCH_SIZE = (() => {
  const value = Number(Deno.env.get("MOMO_ALLOCATOR_BATCH_SIZE") ?? "10");
  return Number.isFinite(value) && value > 0 ? Math.min(value, 50) : 10;
})();
const REQUIRE_TXN_ID =
  (Deno.env.get("MOMO_ALLOCATOR_REQUIRE_TXN_ID") ?? "true").toLowerCase() !==
    "false";
const MIN_CONFIDENCE_FOR_AUTO = Number(
  Deno.env.get("MOMO_ALLOCATOR_MIN_CONFIDENCE") ?? "0.6",
);

const supabase = getServiceClient();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

type InboxRow = {
  id: string;
  raw_text: string;
  msisdn_raw: string | null;
  received_at: string;
  ingest_source: string | null;
  attempts: number | null;
  last_error: string | null;
};

type ParsedResult = {
  amount: number | null;
  currency: string;
  txnId: string | null;
  txnTimestamp: Date | null;
  msisdnNormalized: string | null;
  senderName: string | null;
  confidence: number;
  reason?: string;
  meta: Record<string, unknown>;
};

type Summary = {
  processed: number;
  allocated: number;
  unmatched: number;
  duplicates: number;
  skipped: number;
  errors: Array<{ inboxId: string; message: string }>;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Rate limiting (50 req/min for payment processing)
  const rateLimitCheck = await rateLimitMiddleware(request, {
    limit: 50,
    windowSeconds: 60,
  });

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!;
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  let limit = BATCH_SIZE;
  try {
    const bodyText = await request.text();
    if (bodyText) {
      const parsed = JSON.parse(bodyText) as Record<string, unknown>;
      if (typeof parsed.limit === "number" && Number.isFinite(parsed.limit)) {
        limit = Math.max(1, Math.min(parsed.limit, 50));
      }
    }
  } catch (_error) {
    // Ignore malformed JSON and fall back to defaults
  }

  const summary: Summary = {
    processed: 0,
    allocated: 0,
    unmatched: 0,
    duplicates: 0,
    skipped: 0,
    errors: [],
  };

  const pending = await fetchPending(limit);
  if (pending instanceof Error) {
    return jsonResponse({ ok: false, error: pending.message }, 500);
  }

  if (!pending.length) {
    return jsonResponse({ ok: true, message: "no_pending", summary });
  }

  for (const inboxRow of pending) {
    summary.processed += 1;
    try {
      const result = await processInboxRow(inboxRow);
      switch (result) {
        case "allocated":
          summary.allocated += 1;
          break;
        case "unmatched":
          summary.unmatched += 1;
          break;
        case "duplicate":
          summary.duplicates += 1;
          break;
        case "skipped":
          summary.skipped += 1;
          break;
        default:
          break;
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : String(error ?? "unknown_error");
      summary.errors.push({ inboxId: inboxRow.id, message });
      await markInboxFailure(inboxRow, message);
    }
  }

  return jsonResponse({ ok: true, summary });
});

async function fetchPending(limit: number): Promise<InboxRow[] | Error> {
  const { data, error } = await supabase
    .from("momo_sms_inbox")
    .select(
      "id, raw_text, msisdn_raw, received_at, ingest_source, attempts, last_error",
    )
    .is("processed_at", null)
    .order("received_at", { ascending: true })
    .limit(limit);

  if (error) {
    await logStructuredEvent("ERROR", { data: "momo_allocator.fetch_failed", error });
    return new Error("fetch_pending_failed");
  }

  return (data ?? []) as InboxRow[];
}

async function processInboxRow(
  inboxRow: InboxRow,
): Promise<"allocated" | "unmatched" | "duplicate" | "skipped"> {
  const parsed = parseMomoMessage(inboxRow);

  const parsedInsert = await insertParsedTransaction(inboxRow, parsed);
  if (parsedInsert.status === "duplicate") {
    await markInboxSuccess(inboxRow, "duplicate_txn");
    return "duplicate";
  }

  if (parsedInsert.status === "skipped") {
    await markInboxSuccess(inboxRow, parsed.reason ?? "parse_incomplete");
    return "skipped";
  }

  if (!parsedInsert.parsedId) {
    throw new Error("parsed_id_missing");
  }
  const parsedId = parsedInsert.parsedId;

  if (!parsed.msisdnNormalized) {
    await createUnmatched(parsedId, "msisdn_unresolved", null);
    await markInboxSuccess(inboxRow, "msisdn_unresolved");
    return "unmatched";
  }

  if (parsed.confidence < MIN_CONFIDENCE_FOR_AUTO) {
    await createUnmatched(parsedId, "low_confidence", null);
    await markInboxSuccess(inboxRow, "low_confidence");
    return "unmatched";
  }

  const profile = await findProfileByMsisdn(parsed.msisdnNormalized);
  if (!profile) {
    await createUnmatched(parsedId, "profile_not_found", null);
    await markInboxSuccess(inboxRow, "profile_not_found");
    return "unmatched";
  }

  const membership = await findActiveMembership(profile.user_id);
  if (!membership) {
    await createUnmatched(parsedId, "membership_not_found", null);
    await markInboxSuccess(inboxRow, "membership_not_found");
    return "unmatched";
  }

  if (!parsed.amount || parsed.amount <= 0) {
    await createUnmatched(parsedId, "amount_unavailable", membership.id);
    await markInboxSuccess(inboxRow, "amount_unavailable");
    return "unmatched";
  }

  if (REQUIRE_TXN_ID && !parsed.txnId) {
    await createUnmatched(parsedId, "txn_id_missing", membership.id);
    await markInboxSuccess(inboxRow, "txn_id_missing");
    return "unmatched";
  }

  const ledgerResult = await allocateContribution(
    inboxRow,
    parsed,
    parsedId,
    membership,
  );
  if (ledgerResult === "duplicate") {
    await markInboxSuccess(inboxRow, "duplicate_txn");
    return "duplicate";
  }

  await markInboxSuccess(inboxRow, null);
  return "allocated";
}

function parseMomoMessage(inboxRow: InboxRow): ParsedResult {
  const raw = inboxRow.raw_text ?? "";
  const normalizedMsisdn = normalizeFromInputs(raw, inboxRow.msisdn_raw);

  const amount = extractAmount(raw);
  const currency = extractCurrency(raw) ?? "RWF";
  const txnId = extractTxnId(raw);
  const txnTimestamp = extractTimestamp(raw, inboxRow.received_at);
  const senderName = extractSenderName(raw);

  let confidence = 0.2;
  if (amount !== null) confidence += 0.4;
  if (txnId) confidence += 0.2;
  if (normalizedMsisdn) confidence += 0.1;
  if (senderName) confidence += 0.05;
  if (txnTimestamp) confidence += 0.05;
  if (confidence > 1) confidence = 1;

  const meta: Record<string, unknown> = {
    raw_text: raw,
    msisdn_raw: inboxRow.msisdn_raw,
    msisdn_normalized: normalizedMsisdn,
    ingest_source: inboxRow.ingest_source,
    extracted: {
      amount,
      currency,
      txn_id: txnId,
      sender_name: senderName,
      txn_timestamp: txnTimestamp?.toISOString() ?? null,
    },
  };

  return {
    amount,
    currency,
    txnId,
    txnTimestamp,
    msisdnNormalized: normalizedMsisdn,
    senderName,
    confidence,
    meta,
  };
}

function normalizeFromInputs(
  rawText: string,
  fallback: string | null,
): string | null {
  const candidates: string[] = [];
  if (fallback) candidates.push(fallback);
  const extracted = extractMsisdn(rawText);
  if (extracted) candidates.push(extracted);
  for (const candidate of candidates) {
    const normalized = normalizeE164(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function extractAmount(text: string): number | null {
  const amountRegex =
    /(?:RWF|FRW|FR|RFr|UGX|KES|USD)\s*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/i;
  const match = text.match(amountRegex);
  if (!match) return null;
  const numeric = match[1].replace(/[\s,]/g, "");
  const parsed = Number.parseFloat(numeric);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(2));
}

function extractCurrency(text: string): string | null {
  const match = text.match(/(RWF|FRW|FR|RFr|UGX|KES|USD)/i);
  return match ? match[1].toUpperCase() : null;
}

function extractTxnId(text: string): string | null {
  const match = text.match(
    /(?:TxnID|Transaction ID|Trans ID|Ref[:\s]|Reference[:\s])\s*([A-Za-z0-9-]+)/i,
  );
  return match ? match[1].toUpperCase() : null;
}

function extractSenderName(text: string): string | null {
  const match = text.match(
    /from\s+([A-Za-z][A-Za-z\s'.-]{2,})\s+(?:\+?\d|account|Acct)/i,
  );
  if (!match) return null;
  return match[1].trim();
}

function extractMsisdn(text: string): string | null {
  const match = text.match(/(\+?\d{9,15})/);
  return match ? match[1] : null;
}

function extractTimestamp(text: string, fallback: string): Date {
  const dateMatch = text.match(/on\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
  const timeMatch = text.match(
    /(?:at|@)\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i,
  );
  if (dateMatch) {
    const rawDate = dateMatch[1].replace(/-/g, "/");
    const dateParts = rawDate.split("/");
    if (dateParts.length === 3) {
      let [day, month, year] = dateParts;
      if (year.length === 2) {
        year = `${year < "50" ? "20" : "19"}${year}`;
      }
      const time = timeMatch ? normalizeTime(timeMatch[1]) : "00:00:00";
      const isoCandidate = `${year.padStart(4, "0")}-${
        month.padStart(2, "0")
      }-${day.padStart(2, "0")}T${time}Z`;
      const parsed = new Date(isoCandidate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }
  const fallbackDate = new Date(fallback);
  if (!Number.isNaN(fallbackDate.getTime())) {
    return fallbackDate;
  }
  return new Date();
}

function normalizeTime(raw: string): string {
  const trimmed = raw.trim();
  const ampmMatch = trimmed.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i,
  );
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]) % 12;
    const minutes = ampmMatch[2];
    const seconds = ampmMatch[3] ?? "00";
    if (ampmMatch[4].toUpperCase() === "PM") hours += 12;
    return `${hours.toString().padStart(2, "0")}:${minutes}:${seconds}`;
  }
  const match = trimmed.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const hours = Number(match[1]) % 24;
    const minutes = match[2];
    const seconds = match[3] ?? "00";
    return `${hours.toString().padStart(2, "0")}:${minutes}:${seconds}`;
  }
  return "00:00:00";
}

async function insertParsedTransaction(
  inboxRow: InboxRow,
  parsed: ParsedResult,
): Promise<
  { status: "duplicate" | "skipped" | "inserted"; parsedId?: string }
> {
  if (parsed.amount === null && !parsed.txnId) {
    parsed.reason = "parse_incomplete";
    return { status: "skipped" };
  }

  const insertPayload = {
    inbox_id: inboxRow.id,
    msisdn_e164: parsed.msisdnNormalized,
    sender_name: parsed.senderName,
    amount: parsed.amount,
    currency: parsed.currency,
    txn_id: parsed.txnId,
    txn_ts: parsed.txnTimestamp ? parsed.txnTimestamp.toISOString() : null,
    confidence: parsed.confidence,
    parsed_json: parsed.meta,
  };

  const { data, error } = await supabase
    .from("momo_parsed_txns")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { status: "duplicate" };
    }
    console.error("momo_allocator.parsed_insert_failed", {
      inboxId: inboxRow.id,
      error,
    });
    throw new Error("parsed_insert_failed");
  }

  return { status: "inserted", parsedId: data?.id };
}

async function createUnmatched(
  parsedId: string | undefined,
  reason: string,
  suggestedMemberId: string | null,
) {
  if (!parsedId) return;
  const payload = {
    parsed_id: parsedId,
    reason,
    suggested_member_id: suggestedMemberId,
    status: "open",
  };
  const { error } = await supabase
    .from("momo_unmatched")
    .insert(payload);
  if (error) {
    console.error("momo_allocator.unmatched_insert_failed", {
      parsedId,
      error,
    });
  }
}

async function findProfileByMsisdn(
  msisdn: string,
): Promise<{ user_id: string; whatsapp_e164: string } | null> {
  const candidates = buildNumberLookupCandidates(msisdn);
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, whatsapp_e164")
    .in("whatsapp_e164", candidates)
    .limit(5);
  if (error) {
    await logStructuredEvent("ERROR", { data: "momo_allocator.profile_lookup_failed", error });
    return null;
  }
  if (!data || data.length === 0) return null;
  if (data.length > 1) {
    console.warn("momo_allocator.profile_multiple_matches", {
      msisdn,
      count: data.length,
    });
    return null;
  }
  return data[0] as { user_id: string; whatsapp_e164: string };
}

async function findActiveMembership(
  userId: string,
): Promise<{ id: string; ikimina_id: string } | null> {
  const { data, error } = await supabase
    .from("ibimina_members")
    .select("id, ikimina_id, status")
    .eq("user_id", userId)
    .in("status", ["active"])
    .limit(5);
  if (error) {
    await logStructuredEvent("ERROR", { data: "momo_allocator.membership_lookup_failed", error });
    return null;
  }
  if (!data || data.length === 0) return null;
  if (data.length > 1) {
    console.warn("momo_allocator.membership_multiple", {
      userId,
      count: data.length,
    });
    return null;
  }
  return data[0] as { id: string; ikimina_id: string };
}

function computeCycle(date: Date | null): string {
  const effective = date ?? new Date();
  const year = effective.getUTCFullYear();
  const month = (effective.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${year}${month}`;
}

async function allocateContribution(
  inboxRow: InboxRow,
  parsed: ParsedResult,
  parsedId: string,
  membership: { id: string; ikimina_id: string },
): Promise<"success" | "duplicate"> {
  const cycle = computeCycle(parsed.txnTimestamp);
  const amount = parsed.amount ?? 0;

  const ledgerPayload = {
    ikimina_id: membership.ikimina_id,
    member_id: membership.id,
    amount,
    currency: parsed.currency,
    cycle_yyyymm: cycle,
    txn_id: parsed.txnId,
    allocated_at: parsed.txnTimestamp
      ? parsed.txnTimestamp.toISOString()
      : new Date().toISOString(),
    source: "sms",
    meta: {
      inbox_id: inboxRow.id,
      parsed_id: parsedId,
      sender_name: parsed.senderName,
      msisdn_normalized: parsed.msisdnNormalized,
      ingest_source: inboxRow.ingest_source,
      raw_received_at: inboxRow.received_at,
    },
  };

  const { data, error } = await supabase
    .from("contributions_ledger")
    .insert(ledgerPayload)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return "duplicate";
    }
    console.error("momo_allocator.ledger_insert_failed", {
      inboxId: inboxRow.id,
      error,
    });
    throw new Error("ledger_insert_failed");
  }

  await supabase.rpc("upsert_contribution_cycle", {
    _ikimina_id: membership.ikimina_id,
    _yyyymm: cycle,
    _amount: amount,
  });

  const updatedMeta = {
    ...parsed.meta,
    ledger_id: data?.id ?? null,
  };
  await supabase
    .from("momo_parsed_txns")
    .update({
      parsed_json: updatedMeta,
    })
    .eq("id", parsedId);

  return "success";
}

async function markInboxSuccess(inboxRow: InboxRow, note: string | null) {
  const attempts = (inboxRow.attempts ?? 0) + 1;
  const { error } = await supabase
    .from("momo_sms_inbox")
    .update({
      processed_at: new Date().toISOString(),
      last_error: note,
      attempts,
    })
    .eq("id", inboxRow.id);
  if (error) {
    console.error("momo_allocator.mark_success_failed", {
      inboxId: inboxRow.id,
      error,
    });
  }
}

async function markInboxFailure(inboxRow: InboxRow, note: string) {
  const attempts = (inboxRow.attempts ?? 0) + 1;
  const { error } = await supabase
    .from("momo_sms_inbox")
    .update({
      last_error: note,
      attempts,
    })
    .eq("id", inboxRow.id);
  if (error) {
    console.error("momo_allocator.mark_failure_failed", {
      inboxId: inboxRow.id,
      error,
    });
  }
}
