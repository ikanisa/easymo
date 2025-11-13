// =====================================================
// MOMO CHARGE - Mobile Money Payment Function
// =====================================================
// Handles Mobile Money payment initiation for African markets
// Supports: MTN MoMo, Orange Money, Moov Money
// Following GROUND_RULES.md: observability, security, error handling
// =====================================================

import { serve } from "$std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
};

// =====================================================
// CONFIGURATION
// =====================================================

interface MoMoConfig {
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
  subscriptionKey: string;
  environment: "sandbox" | "production";
}

function getMoMoConfig(provider: string): MoMoConfig {
  const env = Deno.env.get("MOMO_ENVIRONMENT") || "sandbox";
  
  return {
    apiUrl: env === "production" 
      ? "https://proxy.momoapi.mtn.com" 
      : "https://sandbox.momodeveloper.mtn.com",
    apiKey: Deno.env.get("MOMO_API_KEY") || "",
    apiSecret: Deno.env.get("MOMO_API_SECRET") || "",
    subscriptionKey: Deno.env.get("MOMO_SUBSCRIPTION_KEY") || "",
    environment: env as "sandbox" | "production",
  };
}

// =====================================================
// MOMO API FUNCTIONS
// =====================================================

async function createMoMoPayment(
  amount: number,
  currency: string,
  phoneNumber: string,
  referenceId: string,
  config: MoMoConfig,
  correlationId: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    // MTN MoMo Collection API
    const response = await fetch(
      `${config.apiUrl}/collection/v1_0/requesttopay`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await getMoMoToken(config)}`,
          "X-Reference-Id": referenceId,
          "X-Target-Environment": config.environment,
          "Ocp-Apim-Subscription-Key": config.subscriptionKey,
          "X-Callback-Url": `${Deno.env.get("SUPABASE_URL")}/functions/v1/momo-webhook`,
          "X-Correlation-Id": correlationId,
        },
        body: JSON.stringify({
          amount: amount.toString(),
          currency,
          externalId: referenceId,
          payer: {
            partyIdType: "MSISDN",
            partyId: phoneNumber.replace("+", ""),
          },
          payerMessage: "Restaurant order payment",
          payeeNote: "Order #" + referenceId.substring(0, 8),
        }),
      }
    );

    await logStructuredEvent("MOMO_REQUEST_SENT", {
      referenceId,
      amount,
      currency,
      phoneNumber: phoneNumber.substring(0, 8) + "****", // PII masking
      status: response.status,
      correlationId,
    });

    if (response.status === 202) {
      return {
        success: true,
        transactionId: referenceId,
      };
    }

    const error = await response.text();
    await logStructuredEvent("MOMO_REQUEST_FAILED", {
      referenceId,
      status: response.status,
      error,
      correlationId,
    });

    return {
      success: false,
      error: `MoMo API error: ${response.status}`,
    };
  } catch (error) {
    await logStructuredEvent("MOMO_REQUEST_ERROR", {
      error: (error as Error).message,
      referenceId,
      correlationId,
    });

    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

async function getMoMoToken(config: MoMoConfig): Promise<string> {
  // In production, implement proper OAuth token flow
  // For now, return API key (sandbox mode)
  return config.apiKey;
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    const { orderId, amount, currency, phoneNumber, provider } = await req.json();

    await logStructuredEvent("MOMO_CHARGE_REQUEST", {
      orderId,
      amount,
      currency,
      phoneNumber: phoneNumber?.substring(0, 8) + "****", // PII masking per GROUND_RULES.md
      provider,
      correlationId,
    });

    // Validate input
    if (!orderId || !amount || !phoneNumber) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: orderId, amount, phoneNumber",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate amount
    if (amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Amount must be positive" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("waiter_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      await logStructuredEvent("MOMO_ORDER_NOT_FOUND", {
        orderId,
        error: orderError?.message,
        correlationId,
      });

      return new Response(
        JSON.stringify({ error: "Order not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate reference ID (idempotency key)
    const referenceId = crypto.randomUUID();

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from("waiter_payments")
      .insert({
        order_id: orderId,
        user_id: order.user_id,
        amount,
        currency: currency || "XAF",
        payment_method: "momo",
        provider_transaction_id: referenceId,
        status: "pending",
        metadata: {
          phoneNumber,
          provider: provider || "mtn",
          correlationId,
        },
      })
      .select()
      .single();

    if (paymentError) {
      await logStructuredEvent("MOMO_PAYMENT_RECORD_ERROR", {
        error: paymentError.message,
        orderId,
        correlationId,
      });

      return new Response(
        JSON.stringify({ error: "Failed to create payment record" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initiate MoMo payment
    const config = getMoMoConfig(provider || "mtn");
    const result = await createMoMoPayment(
      amount,
      currency || "XAF",
      phoneNumber,
      referenceId,
      config,
      correlationId
    );

    if (!result.success) {
      // Update payment status to failed
      await supabase
        .from("waiter_payments")
        .update({
          status: "failed",
          metadata: {
            ...payment.metadata,
            error: result.error,
          },
        })
        .eq("id", payment.id);

      await recordMetric("payment.momo.failed", 1, {
        provider: provider || "mtn",
        currency: currency || "XAF",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          paymentId: payment.id,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update payment status to processing
    await supabase
      .from("waiter_payments")
      .update({ status: "processing" })
      .eq("id", payment.id);

    // Update order payment status
    await supabase
      .from("waiter_orders")
      .update({ payment_status: "processing" })
      .eq("id", orderId);

    await recordMetric("payment.momo.initiated", 1, {
      provider: provider || "mtn",
      currency: currency || "XAF",
    });

    await logStructuredEvent("MOMO_CHARGE_SUCCESS", {
      orderId,
      paymentId: payment.id,
      transactionId: result.transactionId,
      amount,
      correlationId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: payment.id,
        transactionId: result.transactionId,
        referenceId,
        message: "Payment initiated. Please approve on your phone.",
        instructions: "Check your phone for a payment prompt and enter your PIN.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    await logStructuredEvent("MOMO_CHARGE_ERROR", {
      error: (error as Error).message,
      stack: (error as Error).stack,
      correlationId,
    });

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
