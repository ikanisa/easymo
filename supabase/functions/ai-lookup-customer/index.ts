import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAgentToolRequest } from "shared/auth.ts";
import { isFeatureEnabled } from "shared/feature-flags.ts";

/**
 * AI Agent Tool: Lookup Customer
 * Finds a customer/profile by MSISDN (WhatsApp E.164 number)
 */

interface LookupCustomerRequest {
  msisdn: string;
}

interface LookupCustomerResponse {
  success: boolean;
  exists: boolean;
  name?: string;
  msisdn: string;
  customer_id?: string;
  error?: string;
}

const RESPONSE_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

serve(async (req: Request): Promise<Response> => {
  const correlationId = crypto.randomUUID();

  try {
    // CORS handling
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Agent-JWT, X-Agent-Token, X-Admin-Token",
        },
      });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: RESPONSE_HEADERS }
      );
    }

    if (!isFeatureEnabled("agent.vouchers")) {
      console.warn(
        JSON.stringify({
          event: "ai.tool.lookup_customer.feature_disabled",
          correlation_id: correlationId,
        }),
      );
      return new Response(
        JSON.stringify({ success: false, error: "Feature disabled" }),
        { status: 403, headers: RESPONSE_HEADERS },
      );
    }

    const authCheck = validateAgentToolRequest(req);
    if (!authCheck.ok) {
      const reason = authCheck.reason === "missing_token"
        ? "agent_voucher_token_not_configured"
        : "unauthorized";
      console.error(
        JSON.stringify({
          event: "ai.tool.lookup_customer.auth_failed",
          correlation_id: correlationId,
          reason,
        }),
      );
      return new Response(
        JSON.stringify({ success: false, error: reason, exists: false, msisdn: "" }),
        {
          status: authCheck.reason === "missing_token" ? 500 : 401,
          headers: RESPONSE_HEADERS,
        },
      );
    }

    // Parse request
    const body: LookupCustomerRequest = await req.json();
    const { msisdn } = body;

    if (!msisdn || typeof msisdn !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid msisdn parameter" }),
        { status: 400, headers: RESPONSE_HEADERS }
      );
    }

    // Log request (with PII masking)
    console.log(
      JSON.stringify({
        event: "ai.tool.lookup_customer.start",
        correlation_id: correlationId,
        msisdn_masked: msisdn.substring(0, 5) + "***" + msisdn.slice(-3),
        timestamp: new Date().toISOString(),
      })
    );

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Lookup customer in profiles table
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, whatsapp_e164, display_name")
      .eq("whatsapp_e164", msisdn)
      .maybeSingle();

    if (error) {
      console.error(
        JSON.stringify({
          event: "ai.tool.lookup_customer.error",
          correlation_id: correlationId,
          error: error.message,
        })
      );

      return new Response(
        JSON.stringify({
          success: false,
          exists: false,
          msisdn,
          error: error.message,
        } as LookupCustomerResponse),
        { status: 200, headers: RESPONSE_HEADERS }
      );
    }

    const exists = !!data;
    const response: LookupCustomerResponse = {
      success: true,
      exists,
      name: data?.display_name,
      msisdn,
      customer_id: data?.user_id,
    };

    // Log success
    console.log(
      JSON.stringify({
        event: "ai.tool.lookup_customer.success",
        correlation_id: correlationId,
        exists,
        timestamp: new Date().toISOString(),
      })
    );

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: RESPONSE_HEADERS,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "ai.tool.lookup_customer.exception",
        correlation_id: correlationId,
        error: String(err),
      })
    );

    return new Response(
      JSON.stringify({
        success: false,
        exists: false,
        msisdn: "",
        error: "Internal server error",
      } as LookupCustomerResponse),
      { status: 500, headers: RESPONSE_HEADERS }
    );
  }
});
