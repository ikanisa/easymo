import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { postToLedger } from "../_shared/ledger.ts";
import { encryptField, hashField, maskMsisdn } from "../_shared/crypto.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { writeAuditLog } from "../_shared/audit.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { validateHmacRequest } from "../_shared/auth.ts";
import { parseWithOpenAI, parseWithRegex } from "../_shared/sms-parser.ts";
import { errorCorsResponse, jsonCorsResponse, preflightResponse } from "../_shared/http.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const decoder = new TextDecoder();

interface IngestRequest {
  rawText: string;
  receivedAt: string;
  vendorMeta?: any;
  saccoId?: string;
}

serveWithObservability("ingest-sms", async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return preflightResponse();
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const validation = await validateHmacRequest(req);

    if (!validation.ok) {
      console.warn("ingest-sms.signature_invalid", { reason: validation.reason });
      const status = validation.reason === "stale_timestamp" ? 408 : 401;
      return jsonCorsResponse({ success: false, error: "invalid_signature" }, { status });
    }

    let payload: IngestRequest;
    try {
      payload = JSON.parse(decoder.decode(validation.rawBody)) as IngestRequest;
    } catch (error) {
      console.warn("ingest-sms.json_parse_failed", { error: String(error) });
      return jsonCorsResponse({ success: false, error: "invalid_payload" }, { status: 400 });
    }

    const { rawText, receivedAt, vendorMeta, saccoId } = payload;

    if (!rawText || !receivedAt) {
      return jsonCorsResponse({ success: false, error: "missing_fields" }, { status: 400 });
    }

    const allowed = await enforceRateLimit(supabase, `sms:${saccoId ?? "global"}`, {
      maxHits: 200,
    });

    if (!allowed) {
      return errorCorsResponse("Rate limit exceeded", 429);
    }

    console.log("Ingesting SMS:", { length: rawText.length, receivedAt, saccoId });

    // Step 1: Store raw SMS
    const { data: smsRecord, error: smsError } = await supabase
      .from("sms_inbox")
      .insert({
        raw_text: rawText,
        received_at: receivedAt,
        vendor_meta: vendorMeta,
        sacco_id: saccoId,
        status: "NEW",
      })
      .select()
      .single();

    if (smsError) {
      console.error("Error storing SMS:", smsError);
      throw smsError;
    }

    console.log("SMS stored:", smsRecord.id);

    // Step 2: Parse SMS using regex + OpenAI fallback
    let parsed = parseWithRegex(rawText, receivedAt);
    let parseSource: "REGEX" | "AI" = "REGEX";
    let modelUsed: string | null = null;

    if (!parsed || parsed.confidence < 0.9) {
      console.log("Regex parse low confidence, invoking OpenAI");
      try {
        const aiResult = await parseWithOpenAI(rawText, receivedAt);
        parsed = aiResult.parsed;
        parseSource = "AI";
        modelUsed = aiResult.model;
      } catch (error) {
        console.error("OpenAI parse failed:", error);
        await supabase
          .from("sms_inbox")
          .update({ status: "FAILED", error: "Parse failed" })
          .eq("id", smsRecord.id);
        throw error;
      }
    }

    if (!parsed) {
      await supabase
        .from("sms_inbox")
        .update({ status: "FAILED", error: "Parse failed" })
        .eq("id", smsRecord.id);
      throw new Error("Unable to parse SMS payload");
    }

    console.log("SMS parsed:", { parseSource, confidence: parsed.confidence, modelUsed });

    // Step 3: Update SMS with parsed data
    const encryptedMsisdn = await encryptField(parsed.msisdn);
    const msisdnHash = await hashField(parsed.msisdn);
    const maskedMsisdn = maskMsisdn(parsed.msisdn) ?? parsed.msisdn;

    await supabase
      .from("sms_inbox")
      .update({
        parsed_json: parsed,
        parse_source: parseSource,
        confidence: parsed.confidence,
        msisdn: maskedMsisdn,
        msisdn_encrypted: encryptedMsisdn,
        msisdn_hash: msisdnHash,
        msisdn_masked: maskedMsisdn,
        status: "PARSED",
      })
      .eq("id", smsRecord.id);

    // Step 4: Map to SACCO/Ikimina/Member based on reference
    let mappedSaccoId = saccoId;
    let ikiminaId = null;
    let memberId = null;
    let paymentStatus = "PENDING";

    // Duplicate guard
    const { data: duplicate } = await supabase
      .from("payments")
      .select("id")
      .eq("txn_id", parsed.txn_id)
      .maybeSingle();

    if (duplicate?.id) {
      await supabase
        .from("sms_inbox")
        .update({ status: "APPLIED", error: "Duplicate transaction" })
        .eq("id", smsRecord.id);

      await recordMetric(supabase, "sms_duplicates", 1, {
        saccoId: mappedSaccoId || saccoId,
      });

      return jsonCorsResponse({
        success: true,
        smsId: smsRecord.id,
        paymentId: duplicate.id,
        status: "DUPLICATE",
      });
    }

    if (parsed.reference) {
      // Parse reference: DISTRICT.SACCO.GROUP(.MEMBER)?
      const refParts = parsed.reference.split(".");

      if (refParts.length >= 3) {
        const groupCode = refParts[2];

        // Find Ikimina by code
        const { data: ikimina } = await supabase
          .from("ibimina")
          .select("id, sacco_id")
          .eq("code", groupCode)
          .eq("status", "ACTIVE")
          .single();

        if (ikimina) {
          mappedSaccoId = ikimina.sacco_id;
          ikiminaId = ikimina.id;

          // If member code provided, find member
          if (refParts.length >= 4) {
            const memberCode = refParts[3];

            const { data: member } = await supabase
              .from("ikimina_members")
              .select("id")
              .eq("ikimina_id", ikimina.id)
              .eq("member_code", memberCode)
              .eq("status", "ACTIVE")
              .single();

            if (member) {
              memberId = member.id;
              paymentStatus = "POSTED"; // Auto-approve when fully matched
            } else {
              paymentStatus = "UNALLOCATED"; // Group matched but not member
            }
          } else {
            paymentStatus = "UNALLOCATED"; // No member code provided
          }
        }
      }
    }

    // Step 5: Create Payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        channel: "SMS",
        sacco_id: mappedSaccoId || saccoId,
        ikimina_id: ikiminaId,
        member_id: memberId,
        msisdn: maskedMsisdn,
        msisdn_encrypted: encryptedMsisdn,
        msisdn_hash: msisdnHash,
        msisdn_masked: maskedMsisdn,
        amount: parsed.amount,
        currency: "RWF",
        txn_id: parsed.txn_id,
        reference: parsed.reference,
        occurred_at: parsed.timestamp,
        status: paymentStatus,
        source_id: smsRecord.id,
        ai_version: parseSource === "AI" ? (modelUsed ?? "openai-structured") : null,
        confidence: parsed.confidence,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment:", paymentError);
      throw paymentError;
    }

    console.log("Payment created:", { id: payment.id, status: paymentStatus });

    if (paymentStatus === "POSTED") {
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

    await writeAuditLog(supabase, {
      action: "SMS_INGESTED",
      entity: "SMS_INBOX",
      entityId: smsRecord.id,
      diff: {
        paymentId: payment.id,
        saccoId: mappedSaccoId || saccoId,
        parseSource,
        status: paymentStatus,
      },
    });

    await recordMetric(supabase, "sms_ingested", 1, {
      saccoId: mappedSaccoId || saccoId,
      status: paymentStatus,
      parseSource,
      model: modelUsed ?? null,
    });

    // Step 6: Update SMS status
    await supabase.from("sms_inbox").update({ status: "APPLIED" }).eq("id", smsRecord.id);

    return jsonCorsResponse({
      success: true,
      smsId: smsRecord.id,
      paymentId: payment.id,
      status: paymentStatus,
      parsed,
      parseSource,
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonCorsResponse(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
});
