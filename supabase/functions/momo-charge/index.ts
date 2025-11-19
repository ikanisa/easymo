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
import {
  getPaymentProviderAdapter,
  type PaymentRequest as ProviderPaymentRequest,
  type ProviderSecrets,
  type MobileMoneyProviderId,
} from "../../../services/agent-core/src/payments/index.ts";

const supabase = getServiceClient();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
};

// =====================================================
// CONFIGURATION
// =====================================================

function buildProviderSecrets(providerId: MobileMoneyProviderId): ProviderSecrets {
  if (providerId === 'orange') {
    return {
      apiKey: requireEnv('ORANGE_MONEY_API_KEY'),
      apiSecret: requireEnv('ORANGE_MONEY_API_SECRET'),
      merchantId: requireEnv('ORANGE_MONEY_MERCHANT_ID'),
      callbackUrl: requireEnv('ORANGE_MONEY_CALLBACK_URL', ['SERVICE_URL']),
      environment: (getEnv('ORANGE_MONEY_ENVIRONMENT') || 'sandbox') as 'sandbox' | 'production',
    };
  }

  if (providerId === 'wave') {
    return {
      apiKey: requireEnv('WAVE_API_KEY'),
      merchantId: requireEnv('WAVE_MERCHANT_ID'),
      callbackUrl: requireEnv('WAVE_CALLBACK_URL', ['SERVICE_URL']),
      environment: (getEnv('WAVE_ENVIRONMENT') || 'sandbox') as 'sandbox' | 'production',
    };
  }

  return {
    apiKey: requireEnv('MOMO_API_KEY'),
    apiSecret: requireEnv('MOMO_API_SECRET'),
    subscriptionKey: requireEnv('MOMO_SUBSCRIPTION_KEY'),
    callbackUrl: `${requireEnv('SUPABASE_URL', ['SERVICE_URL'])}/functions/v1/momo-webhook`,
    environment: (getEnv('MOMO_ENVIRONMENT') || 'sandbox') as 'sandbox' | 'production',
  };
}

function buildProviderRequest(
  params: { amount: number; currency: string; phoneNumber: string; referenceId: string; correlationId: string; orderId: string },
): ProviderPaymentRequest {
  return {
    amount: params.amount,
    currency: params.currency,
    phoneNumber: params.phoneNumber,
    referenceId: params.referenceId,
    correlationId: params.correlationId,
    description: `Order ${params.orderId}`,
    metadata: { orderId: params.orderId },
  };
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

    // Initiate provider payment
    const providerId = ((provider ?? 'mtn') as string).toLowerCase() as MobileMoneyProviderId;
    const adapter = getPaymentProviderAdapter(providerId);
    if (!adapter) {
      return new Response(
        JSON.stringify({ error: `Unsupported provider ${provider}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const providerSecrets = buildProviderSecrets(providerId);
    const providerRequest = buildProviderRequest({
      amount,
      currency: currency || 'XAF',
      phoneNumber,
      referenceId,
      correlationId,
      orderId,
    });

    const result = await adapter.initiatePayment(providerRequest, providerSecrets);

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
        provider: providerId,
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
      provider: providerId,
      currency: currency || "XAF",
    });

    await logStructuredEvent("MOMO_CHARGE_SUCCESS", {
      orderId,
      paymentId: payment.id,
      transactionId: result.transactionId,
      amount,
      correlationId,
      provider: providerId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: payment.id,
        transactionId: result.transactionId,
        referenceId,
        message: result.instructions ?? "Payment initiated. Please approve on your phone.",
        instructions: result.instructions ?? "Check your phone for a payment prompt and enter your PIN.",
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
