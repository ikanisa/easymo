import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { recordMetric } from "../_shared/metrics.ts";
import { validateHmacRequest } from "../_shared/auth.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp",
};

const DEFAULT_LOOKBACK_HOURS = parseInt(Deno.env.get("RECON_AUTO_ESCALATE_HOURS") ?? "48", 10);

serveWithObservability("scheduled-reconciliation", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const validation = await validateHmacRequest(req, { toleranceSeconds: 900 });

    if (!validation.ok) {
      console.warn("scheduled-reconciliation.signature_invalid", { reason: validation.reason });
      const status = validation.reason === "stale_timestamp" ? 408 : 401;
      return new Response(JSON.stringify({ success: false, error: "invalid_signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    let windowHours = Math.max(DEFAULT_LOOKBACK_HOURS, 1);
    // Optional override when invoked manually with a JSON body: { "hours": number }
    if (req.method !== "OPTIONS") {
      const contentType = req.headers.get("content-type") ?? "";
      if (contentType.includes("application/json") && validation.rawBody.length > 0) {
        let payload: { hours?: unknown } | null = null;
        try {
          payload = JSON.parse(new TextDecoder().decode(validation.rawBody)) as {
            hours?: unknown;
          } | null;
        } catch (error) {
          console.warn("scheduled-reconciliation.json_parse_failed", { error: String(error) });
          return new Response(JSON.stringify({ success: false, error: "invalid_payload" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }
        if (payload && typeof payload.hours === "number" && Number.isFinite(payload.hours)) {
          // Clamp between 1 hour and 14 days for safety
          const clamped = Math.max(1, Math.min(Math.floor(payload.hours), 14 * 24));
          windowHours = clamped;
        }
      }
    }
    const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

    const { data: pending, error } = await supabase
      .from("payments")
      .select("id, sacco_id, reference, occurred_at, status, msisdn")
      .in("status", ["PENDING", "UNALLOCATED"])
      .lt("occurred_at", cutoff);

    if (error) {
      throw error;
    }

    let queued = 0;

    for (const payment of pending ?? []) {
      const { error: upsertError } = await supabase.from("notification_queue").upsert({
        event: "RECON_ESCALATION",
        payment_id: payment.id,
        channel: "WHATSAPP",
        payload: {
          paymentId: payment.id,
          reference: payment.reference,
          occurredAt: payment.occurred_at,
          status: payment.status,
          to: payment.msisdn,
        },
        scheduled_for: new Date().toISOString(),
      });

      if (upsertError) {
        console.error("notification enqueue error", upsertError);
        continue;
      }

      queued += 1;
    }

    if (queued > 0) {
      await recordMetric(supabase, "recon_escalations", queued);
    }

    return new Response(JSON.stringify({ success: true, queued, checked: pending?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("scheduled-reconciliation error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
