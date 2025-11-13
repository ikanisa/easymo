// =====================================================
// REVOLUT CHARGE - Card Payment Function
// =====================================================
// Handles Revolut/Card payment initiation for EU/UK markets
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

interface RevolutConfig {
  apiUrl: string;
  apiKey: string;
  merchantId: string;
  environment: "sandbox" | "production";
}

function getRevolutConfig(): RevolutConfig {
  const env = Deno.env.get("REVOLUT_ENVIRONMENT") || "sandbox";
  
  return {
    apiUrl: env === "production"
      ? "https://merchant.revolut.com/api/1.0"
      : "https://sandbox-merchant.revolut.com/api/1.0",
    apiKey: Deno.env.get("REVOLUT_API_KEY") || "",
    merchantId: Deno.env.get("REVOLUT_MERCHANT_ID") || "",
    environment: env as "sandbox" | "production",
  };
}

// =====================================================
// REVOLUT API FUNCTIONS
// =====================================================

async function createRevolutOrder(
  amount: number,
  currency: string,
  orderId: string,
  config: RevolutConfig,
  correlationId: string
): Promise<{ success: boolean; checkoutUrl?: string; orderToken?: string; error?: string }> {
  try {
    const response = await fetch(`${config.apiUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "X-Correlation-Id": correlationId,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Amount in cents
        currency,
        merchant_order_ext_ref: orderId,
        description: `Restaurant Order #${orderId.substring(0, 8)}`,
        settlement_currency: currency,
        customer_email: null, // Optional: can be added if available
        metadata: {
          orderId,
          correlationId,
        },
      }),
    });

    await logStructuredEvent("REVOLUT_ORDER_CREATED", {
      orderId,
      amount,
      currency,
      status: response.status,
      correlationId,
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        checkoutUrl: data.checkout_url,
        orderToken: data.public_id,
      };
    }

    const error = await response.text();
    await logStructuredEvent("REVOLUT_ORDER_FAILED", {
      orderId,
      status: response.status,
      error,
      correlationId,
    });

    return {
      success: false,
      error: `Revolut API error: ${response.status}`,
    };
  } catch (error) {
    await logStructuredEvent("REVOLUT_ORDER_ERROR", {
      error: (error as Error).message,
      orderId,
      correlationId,
    });

    return {
      success: false,
      error: (error as Error).message,
    };
  }
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
    const { orderId, amount, currency, returnUrl } = await req.json();

    await logStructuredEvent("REVOLUT_CHARGE_REQUEST", {
      orderId,
      amount,
      currency,
      correlationId,
    });

    // Validate input
    if (!orderId || !amount) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: orderId, amount",
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
      await logStructuredEvent("REVOLUT_ORDER_NOT_FOUND", {
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

    if (existingPayment && existingPayment.metadata?.checkoutUrl) {
      await logStructuredEvent("REVOLUT_CHARGE_IDEMPOTENT", {
        orderId,
        paymentId: existingPayment.id,
        correlationId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          paymentId: existingPayment.id,
          checkoutUrl: existingPayment.metadata.checkoutUrl,
          orderToken: existingPayment.provider_transaction_id,
          message: "Existing payment session found",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from("waiter_payments")
      .insert({
        order_id: orderId,
        user_id: order.user_id,
        amount,
        currency: currency || "EUR",
        payment_method: "revolut",
        status: "pending",
        metadata: {
          correlationId,
          returnUrl,
        },
      })
      .select()
      .single();

    if (paymentError) {
      await logStructuredEvent("REVOLUT_PAYMENT_RECORD_ERROR", {
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

    // Create Revolut order
    const config = getRevolutConfig();
    const result = await createRevolutOrder(
      amount,
      currency || "EUR",
      orderId,
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

      await recordMetric("payment.revolut.failed", 1, {
        currency: currency || "EUR",
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

    // Update payment with Revolut order token
    await supabase
      .from("waiter_payments")
      .update({
        provider_transaction_id: result.orderToken,
        status: "processing",
        metadata: {
          ...payment.metadata,
          checkoutUrl: result.checkoutUrl,
          orderToken: result.orderToken,
        },
      })
      .eq("id", payment.id);

    // Update order payment status
    await supabase
      .from("waiter_orders")
      .update({ payment_status: "processing" })
      .eq("id", orderId);

    await recordMetric("payment.revolut.initiated", 1, {
      currency: currency || "EUR",
    });

    await logStructuredEvent("REVOLUT_CHARGE_SUCCESS", {
      orderId,
      paymentId: payment.id,
      orderToken: result.orderToken,
      amount,
      correlationId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: payment.id,
        checkoutUrl: result.checkoutUrl,
        orderToken: result.orderToken,
        message: "Payment session created. Redirecting to checkout...",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    await logStructuredEvent("REVOLUT_CHARGE_ERROR", {
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
