import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { postToLedger, settleLedger } from "../_shared/ledger.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { writeAuditLog } from "../_shared/audit.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "ASSIGN" | "SETTLE" | "REJECT";

interface SettleRequest {
  paymentId: string;
  action: Action;
  ikiminaId?: string;
  memberId?: string;
  autoPost?: boolean;
  actorId?: string | null;
}

serveWithObservability("settle-payment", async (req) => {
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
    const body = (await req.json()) as SettleRequest;

    const allowed = await enforceRateLimit(supabase, `settle:${body.paymentId}`, {
      maxHits: 20,
      windowSeconds: 60,
    });

    if (!allowed) {
      return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", body.paymentId)
      .single();

    if (paymentError || !payment) {
      throw paymentError ?? new Error("Payment not found");
    }

    if (body.action === "ASSIGN") {
      if (!body.ikiminaId || !body.memberId) {
        throw new Error("Ikimina and member are required for assignment");
      }

      const updates = {
        ikimina_id: body.ikiminaId,
        member_id: body.memberId,
        status: body.autoPost ? "POSTED" : "PENDING",
      };

      const { error: updateError } = await supabase
        .from("payments")
        .update(updates)
        .eq("id", payment.id);

      if (updateError) {
        throw updateError;
      }

      if (body.autoPost) {
        await postToLedger(supabase, {
          id: payment.id,
          sacco_id: payment.sacco_id,
          ikimina_id: body.ikiminaId,
          member_id: body.memberId,
          amount: payment.amount,
          currency: payment.currency,
          txn_id: payment.txn_id,
        });
      }
    } else if (body.action === "SETTLE") {
      if (payment.status !== "POSTED" && payment.status !== "SETTLED") {
        throw new Error("Only posted payments can be settled");
      }

      await settleLedger(supabase, {
        id: payment.id,
        sacco_id: payment.sacco_id,
        ikimina_id: payment.ikimina_id,
        member_id: payment.member_id,
        amount: payment.amount,
        currency: payment.currency,
        txn_id: payment.txn_id,
      });

      const { error: updateError } = await supabase
        .from("payments")
        .update({ status: "SETTLED" })
        .eq("id", payment.id);

      if (updateError) {
        throw updateError;
      }
    } else if (body.action === "REJECT") {
      const { error: updateError } = await supabase
        .from("payments")
        .update({ status: "REJECTED" })
        .eq("id", payment.id);

      if (updateError) {
        throw updateError;
      }
    }

    const { data: refreshed } = await supabase
      .from("payments")
      .select("*")
      .eq("id", payment.id)
      .single();

    await writeAuditLog(supabase, {
      actorId: body.actorId,
      action: `PAYMENT_${body.action}`,
      entity: "PAYMENT",
      entityId: payment.id,
      diff: {
        previousStatus: payment.status,
        nextStatus: refreshed?.status,
        ikiminaId: body.ikiminaId ?? payment.ikimina_id,
        memberId: body.memberId ?? payment.member_id,
      },
    });

    await recordMetric(supabase, "payment_action", 1, {
      action: body.action,
      saccoId: payment.sacco_id,
    });

    return new Response(JSON.stringify({ success: true, payment: refreshed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Settlement error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
