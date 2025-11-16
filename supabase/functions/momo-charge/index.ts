// =====================================================
// MOMO CHARGE - Mobile Money Payment Function
// =====================================================
// Handles Mobile Money payment initiation for African markets
// Supports: MTN MoMo, Orange Money, Moov Money
// Following GROUND_RULES.md: observability, security, error handling
// =====================================================

import { serve } from "$std/http/server.ts";
import { logStructuredEvent, recordMetric, maskPII } from "../_shared/observability.ts";
import { getServiceClient } from "shared/supabase.ts";
import { getEnv, requireEnv } from "shared/env.ts";

const supabase = getServiceClient();

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
  const env = getEnv("MOMO_ENVIRONMENT") || "sandbox";
  const apiKey = requireEnv("MOMO_API_KEY");
  const apiSecret = requireEnv("MOMO_API_SECRET");
  const subscriptionKey = requireEnv("MOMO_SUBSCRIPTION_KEY");

  return {
    apiUrl: env === "production"
      ? "https://proxy.momoapi.mtn.com"
      : "https://sandbox.momodeveloper.mtn.com",
    apiKey,
    apiSecret,
    subscriptionKey,
    environment: env as "sandbox" | "production",
  };
}
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
          "X-Callback-Url": `${requireEnv("SUPABASE_URL", ["SERVICE_URL"])}/functions/v1/momo-webhook`,
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
      phoneNumber: maskPII(phoneNumber, 7, 3),
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

interface MoMoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number | string;
}

const momoTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getMoMoToken(config: MoMoConfig): Promise<string> {
  const cacheKey = `${config.apiKey}:${config.environment}`;
  const cachedToken = momoTokenCache.get(cacheKey);
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  if (!config.apiKey || !config.apiSecret) {
    throw new Error("MoMo API credentials not configured");
  }

  if (!config.subscriptionKey) {
    throw new Error("MoMo subscription key not configured");
  }

  const basicAuth = btoa(`${config.apiKey}:${config.apiSecret}`);

  const response = await fetch(`${config.apiUrl}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    await logStructuredEvent("MOMO_TOKEN_ERROR", {
      status: response.status,
      error: errorBody,
    });
    throw new Error(`Failed to obtain MoMo access token: ${response.status}`);
  }

  const tokenData = (await response.json()) as MoMoTokenResponse;
  const expiresInSeconds = Number(tokenData.expires_in || 0);
  const expiresAt = Date.now() + Math.max(expiresInSeconds - 30, 30) * 1000;

  momoTokenCache.set(cacheKey, {
    token: tokenData.access_token,
    expiresAt,
  });

  return tokenData.access_token;
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
      phoneNumber: maskPII(phoneNumber, 7, 3),
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

    // Check for existing payment (idempotency)
    const { data: existingPayment } = await supabase
      .from("waiter_payments")
      .select("*")
      .eq("order_id", orderId)
      .in("status", ["pending", "processing"])
      .single();

    if (existingPayment) {
      await logStructuredEvent("MOMO_CHARGE_IDEMPOTENT", {
        orderId,
        paymentId: existingPayment.id,
        correlationId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          paymentId: existingPayment.id,
          transactionId: existingPayment.provider_transaction_id,
          referenceId: existingPayment.provider_transaction_id,
          message: "Payment already in progress. Please approve on your phone.",
          instructions: "Check your phone for a payment prompt and enter your PIN.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate reference ID (idempotency key)
    const referenceId = crypto.randomUUID();

    // Create payment record (store masked phone in metadata, not full number)
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
          phoneNumberMasked: maskPII(phoneNumber, 7, 3),
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
