import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAgentToolRequest } from "shared/auth.ts";
import { isFeatureEnabled } from "shared/feature-flags.ts";

/**
 * AI Agent Tool: Create Voucher
 * Creates a new fuel voucher for a customer
 */

interface CreateVoucherRequest {
  customer_msisdn: string;
  amount: number;
  currency?: string;
}

interface CreateVoucherResponse {
  success: boolean;
  voucher_id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  error?: string;
}

const RESPONSE_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

// Generate a 5-digit voucher code
function generateCode5(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// Generate QR payload
function generateQRPayload(voucherId: string, code5: string): string {
  return `EASYMO-VOUCHER:${voucherId}:${code5}`;
}

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
          event: "ai.tool.create_voucher.feature_disabled",
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
          event: "ai.tool.create_voucher.auth_failed",
          correlation_id: correlationId,
          reason,
        }),
      );
      return new Response(
        JSON.stringify({ success: false, error: reason }),
        {
          status: authCheck.reason === "missing_token" ? 500 : 401,
          headers: RESPONSE_HEADERS,
        },
      );
    }

    // Parse request
    const body: CreateVoucherRequest = await req.json();
    const { customer_msisdn, amount, currency = "RWF" } = body;

    // Validation
    if (!customer_msisdn || typeof customer_msisdn !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid customer_msisdn" }),
        { status: 400, headers: RESPONSE_HEADERS }
      );
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid amount" }),
        { status: 400, headers: RESPONSE_HEADERS }
      );
    }

    // Log request (with PII masking)
    console.log(
      JSON.stringify({
        event: "ai.tool.create_voucher.start",
        correlation_id: correlationId,
        msisdn_masked: customer_msisdn.substring(0, 5) + "***" + customer_msisdn.slice(-3),
        amount,
        currency,
        timestamp: new Date().toISOString(),
      })
    );

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Lookup customer first
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("whatsapp_e164", customer_msisdn)
      .maybeSingle();

    // Generate voucher data
    const voucherId = crypto.randomUUID();
    const code5 = generateCode5();
    const qrPayload = generateQRPayload(voucherId, code5);
    const amountMinor = Math.round(amount * 100); // Convert to minor units (cents)

    // Create voucher
    const { data, error } = await supabase
      .from("vouchers")
      .insert({
        id: voucherId,
        code_5: code5,
        amount_minor: amountMinor,
        currency,
        status: "issued",
        user_id: profile?.user_id || null,
        whatsapp_e164: customer_msisdn,
        policy_number: `AI-${Date.now()}`, // Placeholder policy number
        qr_payload: qrPayload,
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error(
        JSON.stringify({
          event: "ai.tool.create_voucher.error",
          correlation_id: correlationId,
          error: error.message,
        })
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        } as CreateVoucherResponse),
        { status: 200, headers: RESPONSE_HEADERS }
      );
    }

    const response: CreateVoucherResponse = {
      success: true,
      voucher_id: data.id,
      status: data.status,
      amount: amountMinor / 100, // Convert back to major units
      currency: data.currency,
    };

    // Log success
    console.log(
      JSON.stringify({
        event: "ai.tool.create_voucher.success",
        correlation_id: correlationId,
        voucher_id: data.id,
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
        event: "ai.tool.create_voucher.exception",
        correlation_id: correlationId,
        error: String(err),
      })
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
      } as CreateVoucherResponse),
      { status: 500, headers: RESPONSE_HEADERS }
    );
  }
});
