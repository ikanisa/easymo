import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptField, hashField, maskMsisdn } from "../_shared/crypto.ts";
import { writeAuditLog } from "../_shared/audit.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "REPROCESS" | "FLAG";

interface ReviewRequest {
  smsId: string;
  action: Action;
  actorId?: string | null;
}

serveWithObservability("sms-review", async (req) => {
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
    const body = (await req.json()) as ReviewRequest;

    const { data: sms, error: smsError } = await supabase
      .from("sms_inbox")
      .select("id, raw_text, sacco_id, status")
      .eq("id", body.smsId)
      .single();

    if (smsError || !sms) {
      throw smsError ?? new Error("SMS not found");
    }

    if (body.action === "FLAG") {
      await supabase
        .from("sms_inbox")
        .update({ status: "FAILED", error: "Flagged for manual review" })
        .eq("id", sms.id);

      await writeAuditLog(supabase, {
        actorId: body.actorId,
        action: "SMS_FLAGGED",
        entity: "SMS_INBOX",
        entityId: sms.id,
      });

      await recordMetric(supabase, "sms_flagged", 1, { saccoId: sms.sacco_id });

      return new Response(JSON.stringify({ success: true, status: "FLAGGED" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parseResponse = await supabase.functions.invoke("parse-sms", {
      body: { rawText: sms.raw_text, receivedAt: new Date().toISOString() },
    });

    if (parseResponse.error) {
      throw parseResponse.error;
    }

    const { parsed, parseSource, modelUsed } = parseResponse.data as {
      parsed: {
        msisdn: string;
        confidence: number;
        reference?: string | null;
        txn_id: string;
        amount: number;
        timestamp: string;
      };
      parseSource: string;
      modelUsed?: string | null;
    };

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
        error: null,
      })
      .eq("id", sms.id);

    await writeAuditLog(supabase, {
      actorId: body.actorId,
      action: "SMS_REPROCESSED",
      entity: "SMS_INBOX",
      entityId: sms.id,
      diff: { parseSource },
    });

    await recordMetric(supabase, "sms_reprocessed", 1, {
      saccoId: sms.sacco_id,
      parseSource,
      model: modelUsed ?? null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: "PARSED",
        parsed,
        parseSource,
        modelUsed: modelUsed ?? null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("sms-review error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
