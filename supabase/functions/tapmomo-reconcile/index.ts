import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http.ts";

interface ReconcileRequest {
  id?: string;
  merchant_code?: string;
  nonce?: string;
  status: "settled" | "failed";
  payer_hint?: string;
  error_message?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body: ReconcileRequest = await req.json();

    if (!["settled", "failed"].includes(body.status)) {
      return new Response(JSON.stringify({ error: "Invalid status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase.from("tapmomo_transactions").update({
      status: body.status,
      ...(body.payer_hint && { payer_hint: body.payer_hint }),
      ...(body.error_message && { error_message: body.error_message }),
      ...(body.status === "settled" && { settled_at: new Date().toISOString() }),
    });

    if (body.id) {
      query = query.eq("id", body.id);
    } else if (body.merchant_code && body.nonce) {
      const { data: merchant, error: merchantError } = await supabase
        .from("tapmomo_merchants")
        .select("id")
        .eq("merchant_code", body.merchant_code)
        .single();

      if (merchantError || !merchant) {
        return new Response(JSON.stringify({ error: "Merchant not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      query = query.eq("merchant_id", merchant.id).eq("nonce", body.nonce);
    } else {
      return new Response(
        JSON.stringify({ error: "Either id or (merchant_code + nonce) required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data, error } = await query.select().single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, transaction: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
