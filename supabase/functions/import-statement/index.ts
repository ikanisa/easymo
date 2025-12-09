import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { postToLedger } from "../_shared/ledger.ts";
import { encryptField, hashField, maskMsisdn } from "../_shared/crypto.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { writeAuditLog } from "../_shared/audit.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatementRow {
  occurredAt: string;
  txnId: string;
  msisdn: string;
  amount: number;
  reference?: string | null;
  status?: string | null;
}

interface ImportRequest {
  saccoId: string;
  ikiminaId?: string;
  rows: StatementRow[];
  actorId?: string | null;
}

const parseReference = (reference: string | null | undefined) => {
  if (!reference) return { groupCode: null, memberCode: null };
  const parts = reference.split(".");
  if (parts.length < 3) {
    return { groupCode: null, memberCode: null };
  }
  const groupCode = parts[2];
  const memberCode = parts[3] ?? null;
  return { groupCode, memberCode };
};

serveWithObservability("import-statement", async (req) => {
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
    const payload = (await req.json()) as ImportRequest;
    if (!payload || !payload.saccoId || !Array.isArray(payload.rows)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid payload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const allowed = await enforceRateLimit(supabase, `statement:${payload.saccoId}`, {
      maxHits: Math.max(payload.rows.length, 100),
      windowSeconds: 60,
    });

    if (!allowed) {
      return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    let inserted = 0;
    let duplicates = 0;
    let posted = 0;
    let unallocated = 0;

    for (const row of payload.rows) {
      if (!row.txnId || !row.msisdn || !Number.isFinite(row.amount) || row.amount <= 0) {
        // skip invalid row but do not fail entire payload
        continue;
      }
      const { data: existing } = await supabase
        .from("payments")
        .select("id")
        .eq("txn_id", row.txnId)
        .maybeSingle();

      if (existing?.id) {
        duplicates += 1;
        continue;
      }

      const { groupCode, memberCode } = parseReference(row.reference);

      let ikiminaId = payload.ikiminaId ?? null;
      let memberId: string | null = null;

      if (!ikiminaId && groupCode) {
        const { data: ikimina } = await supabase
          .from("ibimina")
          .select("id, sacco_id")
          .eq("code", groupCode)
          .eq("status", "ACTIVE")
          .maybeSingle();

        if (ikimina?.id) {
          ikiminaId = ikimina.id;
        }
      }

      if (ikiminaId && memberCode) {
        const { data: member } = await supabase
          .from("ikimina_members")
          .select("id")
          .eq("ikimina_id", ikiminaId)
          .eq("member_code", memberCode)
          .eq("status", "ACTIVE")
          .maybeSingle();

        if (member?.id) {
          memberId = member.id;
        }
      }

      let status: string = "PENDING";

      if (ikiminaId && memberId) {
        status = "POSTED";
      } else if (ikiminaId && !memberId) {
        status = "UNALLOCATED";
      }

      const maskedMsisdn = maskMsisdn(row.msisdn) ?? row.msisdn;
      const encryptedMsisdn = await encryptField(row.msisdn);
      const msisdnHash = await hashField(row.msisdn);

      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          channel: "STATEMENT",
          sacco_id: payload.saccoId,
          ikimina_id: ikiminaId,
          member_id: memberId,
          msisdn: maskedMsisdn,
          msisdn_encrypted: encryptedMsisdn,
          msisdn_hash: msisdnHash,
          msisdn_masked: maskedMsisdn,
          amount: row.amount,
          currency: "RWF",
          txn_id: row.txnId,
          reference: row.reference,
          occurred_at: row.occurredAt,
          status,
          confidence: 1,
        })
        .select("*")
        .single();

      if (paymentError) {
        console.error("Payment insert error", paymentError);
        throw paymentError;
      }

      inserted += 1;

      if (status === "POSTED") {
        await postToLedger(supabase, {
          id: payment.id,
          sacco_id: payment.sacco_id,
          ikimina_id: payment.ikimina_id,
          member_id: payment.member_id,
          amount: payment.amount,
          currency: payment.currency,
          txn_id: payment.txn_id,
        });
        posted += 1;
      }

      if (status === "UNALLOCATED") {
        unallocated += 1;
      }

      await recordMetric(supabase, "statement_imported", 1, {
        saccoId: payload.saccoId,
        status,
      });
    }

    await writeAuditLog(supabase, {
      actorId: payload.actorId,
      action: "STATEMENT_IMPORT",
      entity: "SACCO",
      entityId: payload.saccoId,
      diff: { inserted, duplicates },
    });

    return new Response(
      JSON.stringify({ success: true, inserted, duplicates, posted, unallocated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Statement import error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
