import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http.ts";

interface TransferRequest {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  currency?: string;
  memo?: string;
  idempotency_key?: string;
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

    const body: TransferRequest = await req.json();

    // Validate inputs
    if (!body.from_account_id || !body.to_account_id) {
      return new Response(
        JSON.stringify({ error: "Missing from_account_id or to_account_id" }),
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

    // Call the database function
    const { data, error } = await supabase.rpc("wallet_transfer", {
      p_from_account: body.from_account_id,
      p_to_account: body.to_account_id,
      p_amount: body.amount,
      p_currency: body.currency || "USDt",
      p_memo: body.memo || null,
      p_idempotency_key: body.idempotency_key || null,
    });

    if (error) {
      console.error("Transfer error:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Transfer failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        journal_id: data,
        message: "Transfer completed successfully",
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
