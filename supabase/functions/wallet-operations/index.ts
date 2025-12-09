import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http.ts";

interface WalletOperationRequest {
  operation: "buy" | "mint" | "burn" | "spend";
  account_id: string;
  amount: number;
  currency?: string;
  memo?: string;
  idempotency_key?: string;
  // For buy/burn operations
  payment_id?: string;
  momo_txn_id?: string;
  // For spend operation
  merchant_account_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const body: WalletOperationRequest = await req.json();

    // Validate inputs
    if (!body.operation || !["buy", "mint", "burn", "spend"].includes(body.operation)) {
      return new Response(
        JSON.stringify({ error: "Invalid operation" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!body.account_id) {
      return new Response(
        JSON.stringify({ error: "Missing account_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let result;
    let error;

    switch (body.operation) {
      case "buy":
        ({ data: result, error } = await supabase.rpc("wallet_buy_tokens", {
          p_account_id: body.account_id,
          p_amount: body.amount,
          p_currency: body.currency || "USDt",
          p_payment_id: body.payment_id || null,
          p_memo: body.memo || null,
          p_idempotency_key: body.idempotency_key || null,
        }));
        break;

      case "mint":
        ({ data: result, error } = await supabase.rpc("wallet_mint_tokens", {
          p_account_id: body.account_id,
          p_amount: body.amount,
          p_currency: body.currency || "USDt",
          p_memo: body.memo || null,
          p_idempotency_key: body.idempotency_key || null,
        }));
        break;

      case "burn":
        ({ data: result, error } = await supabase.rpc("wallet_burn_tokens", {
          p_account_id: body.account_id,
          p_amount: body.amount,
          p_currency: body.currency || "USDt",
          p_momo_txn_id: body.momo_txn_id || null,
          p_memo: body.memo || null,
          p_idempotency_key: body.idempotency_key || null,
        }));
        break;

      case "spend":
        if (!body.merchant_account_id) {
          return new Response(
            JSON.stringify({ error: "Missing merchant_account_id for spend operation" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        ({ data: result, error } = await supabase.rpc("wallet_spend_tokens", {
          p_payer_account: body.account_id,
          p_merchant_account: body.merchant_account_id,
          p_amount: body.amount,
          p_currency: body.currency || "USDt",
          p_memo: body.memo || null,
          p_idempotency_key: body.idempotency_key || null,
        }));
        break;
    }

    if (error) {
      console.error(`${body.operation} error:`, error);
      return new Response(
        JSON.stringify({ error: error.message || `${body.operation} failed` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        journal_id: result,
        operation: body.operation,
        message: `${body.operation} completed successfully`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
