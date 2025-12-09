import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { postToLedger } from "../_shared/ledger.ts";
import { encryptField, hashField, maskMsisdn } from "../_shared/crypto.ts";
import { writeAuditLog } from "../_shared/audit.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THRESHOLD_MINUTES = Math.max(
  parseInt(Deno.env.get("SMS_AUTOMATION_THRESHOLD_MINUTES") ?? "10", 10),
  1
);
const MAX_BATCH = Math.max(parseInt(Deno.env.get("SMS_AUTOMATION_BATCH") ?? "25", 10), 1);

interface SmsRecord {
  id: string;
  sacco_id: string | null;
  raw_text: string;
  received_at: string;
  vendor_meta: Record<string, unknown> | null;
  status: string;
}

interface ParseResponse {
  parsed: {
    msisdn: string;
    confidence: number;
    reference?: string | null;
    txn_id: string;
    amount: number;
    timestamp: string;
  };
  parseSource: "REGEX" | "AI" | string;
  modelUsed?: string | null;
}

const getCutoffIso = () => new Date(Date.now() - THRESHOLD_MINUTES * 60 * 1000).toISOString();

const withLock = async (supabase: ReturnType<typeof createClient>, sms: SmsRecord) => {
  const { data, error } = await supabase
    .from("sms_inbox")
    .update({ status: "PROCESSING", error: null })
    .eq("id", sms.id)
    .eq("status", sms.status)
    .select("id")
    .single();

  if (error || !data) {
    return false;
  }

  return true;
};

const findIkimina = async (
  supabase: ReturnType<typeof createClient>,
  reference: string | null | undefined
) => {
  if (!reference) {
    return {
      saccoId: null as string | null,
      ikiminaId: null as string | null,
      memberId: null as string | null,
      status: "PENDING",
    };
  }

  const parts = reference.split(".");
  if (parts.length < 3) {
    return { saccoId: null, ikiminaId: null, memberId: null, status: "PENDING" };
  }

  const groupCode = parts[2];
  const memberCode = parts.length >= 4 ? parts[3] : null;

  const { data: ikimina } = await supabase
    .from("ibimina")
    .select("id, sacco_id")
    .eq("code", groupCode)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!ikimina) {
    return { saccoId: null, ikiminaId: null, memberId: null, status: "PENDING" };
  }

  let memberId: string | null = null;
  let status = "UNALLOCATED";

  if (memberCode) {
    const { data: member } = await supabase
      .from("ikimina_members")
      .select("id")
      .eq("ikimina_id", ikimina.id)
      .eq("member_code", memberCode)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (member) {
      memberId = member.id;
      status = "POSTED";
    }
  }

  return { saccoId: ikimina.sacco_id as string, ikiminaId: ikimina.id as string, memberId, status };
};

const persistPayment = async (
  supabase: ReturnType<typeof createClient>,
  sms: SmsRecord,
  parse: ParseResponse,
  mapping: {
    saccoId: string | null;
    ikiminaId: string | null;
    memberId: string | null;
    status: string;
  }
) => {
  const encryptedMsisdn = await encryptField(parse.parsed.msisdn);
  const msisdnHash = await hashField(parse.parsed.msisdn);
  const maskedMsisdn = maskMsisdn(parse.parsed.msisdn) ?? parse.parsed.msisdn;

  const { data: duplicate } = await supabase
    .from("payments")
    .select("id, status")
    .eq("txn_id", parse.parsed.txn_id)
    .maybeSingle();

  if (duplicate?.id) {
    await supabase
      .from("sms_inbox")
      .update({ status: "APPLIED", error: "Duplicate transaction" })
      .eq("id", sms.id);
    return {
      reusedPaymentId: duplicate.id,
      status: duplicate.status,
      created: false,
      msisdn: { encrypted: encryptedMsisdn, hash: msisdnHash, masked: maskedMsisdn },
    };
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      channel: "SMS",
      sacco_id: mapping.saccoId ?? sms.sacco_id,
      ikimina_id: mapping.ikiminaId,
      member_id: mapping.memberId,
      msisdn: maskedMsisdn,
      msisdn_encrypted: encryptedMsisdn,
      msisdn_hash: msisdnHash,
      msisdn_masked: maskedMsisdn,
      amount: parse.parsed.amount,
      currency: "RWF",
      txn_id: parse.parsed.txn_id,
      reference: parse.parsed.reference ?? null,
      occurred_at: parse.parsed.timestamp,
      status: mapping.status,
      source_id: sms.id,
      ai_version: parse.parseSource === "AI" ? (parse.modelUsed ?? "openai-structured") : null,
      confidence: parse.parsed.confidence,
    })
    .select()
    .single();

  if (paymentError) {
    throw paymentError;
  }

  if (payment.status === "POSTED") {
    await postToLedger(supabase, {
      id: payment.id,
      sacco_id: payment.sacco_id,
      ikimina_id: payment.ikimina_id,
      member_id: payment.member_id,
      amount: payment.amount,
      currency: payment.currency,
      txn_id: payment.txn_id,
    });
  }

  return {
    createdPayment: payment,
    created: true,
    msisdn: { encrypted: encryptedMsisdn, hash: msisdnHash, masked: maskedMsisdn },
  };
};

serveWithObservability("gsm-maintenance", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const cutoff = getCutoffIso();
    const { data: candidates, error: fetchError } = await supabase
      .from("sms_inbox")
      .select("id, sacco_id, raw_text, received_at, vendor_meta, status")
      .in("status", ["NEW", "FAILED", "PARSED"])
      .lt("received_at", cutoff)
      .order("received_at", { ascending: true })
      .limit(MAX_BATCH);

    if (fetchError) {
      throw fetchError;
    }

    let processed = 0;
    let posted = 0;
    let retried = 0;
    let failed = 0;

    for (const sms of candidates ?? []) {
      const canProcess = await withLock(supabase, sms as SmsRecord);
      if (!canProcess) {
        continue;
      }

      try {
        const parseResponse = await supabase.functions.invoke("parse-sms", {
          body: {
            rawText: sms.raw_text,
            receivedAt: sms.received_at,
            vendorMeta: sms.vendor_meta ?? undefined,
          },
        });

        if (parseResponse.error) {
          await supabase
            .from("sms_inbox")
            .update({ status: "FAILED", error: parseResponse.error.message ?? "Parse failed" })
            .eq("id", sms.id);
          failed += 1;
          await recordMetric(supabase, "sms_reprocess_failed", 1, { smsId: sms.id });
          continue;
        }

        const parse = parseResponse.data as ParseResponse;

        const mapping = await findIkimina(supabase, parse.parsed.reference ?? null);
        const result = await persistPayment(supabase, sms as SmsRecord, parse, mapping);

        await supabase
          .from("sms_inbox")
          .update({
            parsed_json: parse.parsed,
            parse_source: parse.parseSource,
            confidence: parse.parsed.confidence,
            msisdn: result.msisdn.masked,
            msisdn_encrypted: result.msisdn.encrypted,
            msisdn_hash: result.msisdn.hash,
            msisdn_masked: result.msisdn.masked,
            status: "APPLIED",
            error: null,
          })
          .eq("id", sms.id);

        await writeAuditLog(supabase, {
          action: "SMS_AUTOMATION_REPLAYED",
          entity: "SMS_INBOX",
          entityId: sms.id,
          diff: {
            status: result.created ? mapping.status : "DUPLICATE",
            parseSource: parse.parseSource,
          },
        });

        await recordMetric(supabase, "sms_reprocessed", 1, {
          saccoId: mapping.saccoId ?? sms.sacco_id,
          parseSource: parse.parseSource,
          model: parse.modelUsed ?? null,
        });

        processed += 1;
        if (mapping.status === "POSTED") {
          posted += 1;
        }
        if (result.created) {
          retried += 1;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        await supabase
          .from("sms_inbox")
          .update({ status: "FAILED", error: message })
          .eq("id", sms.id);
        failed += 1;
        await recordMetric(supabase, "sms_reprocess_failed", 1, {
          smsId: sms.id,
          reason: "exception",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        posted,
        retried,
        failed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("gsm-maintenance error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
