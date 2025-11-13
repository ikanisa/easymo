// =====================================================
// REVOLUT WEBHOOK - Payment Status Callback
// =====================================================
// Handles callbacks from Revolut API for payment status updates
// Following GROUND_RULES.md: observability, security, webhook verification
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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id, revolut-signature",
};

// =====================================================
// WEBHOOK SIGNATURE VERIFICATION
// =====================================================

async function verifyRevolutSignature(
  payload: string,
  signature: string | null,
  timestamp: string | null
): Promise<boolean> {
  if (!signature || !timestamp) {
    return false; // No signature provided
  }

  const webhookSecret = Deno.env.get("REVOLUT_WEBHOOK_SECRET") || "";
  if (!webhookSecret) {
    // In sandbox mode without secret, skip verification
    return true;
  }

  try {
    const encoder = new TextEncoder();
    const message = `${timestamp}.${payload}`;
    
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(message)
    );

    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    return expectedSignature === signature;
  } catch (error) {
    await logStructuredEvent("REVOLUT_WEBHOOK_SIGNATURE_ERROR", {
      error: (error as Error).message,
    });
    return false;
  }
}

// =====================================================
// PAYMENT STATUS UPDATE
// =====================================================

async function updatePaymentStatus(
  orderToken: string,
  event: string,
  orderData: any,
  correlationId?: string
): Promise<void> {
  try {
    // Get payment by order token
    const { data: payment, error: paymentError } = await supabase
      .from("waiter_payments")
      .select("*, waiter_orders(*)")
      .eq("provider_transaction_id", orderToken)
      .single();

    if (paymentError || !payment) {
      await logStructuredEvent("REVOLUT_WEBHOOK_PAYMENT_NOT_FOUND", {
        orderToken,
        event,
        correlationId,
      });
      return;
    }

    // Map Revolut event to our status
    let paymentStatus: string;
    let orderPaymentStatus: string;
    let orderStatus: string | undefined;

    switch (event) {
      case "ORDER_COMPLETED":
        paymentStatus = "successful";
        orderPaymentStatus = "successful";
        orderStatus = "confirmed";
        break;
      case "ORDER_AUTHORISED":
        paymentStatus = "successful";
        orderPaymentStatus = "successful";
        orderStatus = "confirmed";
        break;
      case "ORDER_CANCELLED":
      case "ORDER_PAYMENT_DECLINED":
        paymentStatus = "failed";
        orderPaymentStatus = "failed";
        break;
      case "ORDER_PAYMENT_PENDING":
        paymentStatus = "processing";
        orderPaymentStatus = "processing";
        break;
      default:
        paymentStatus = "pending";
        orderPaymentStatus = "pending";
    }

    // Update payment record
    await supabase
      .from("waiter_payments")
      .update({
        status: paymentStatus,
        processed_at: new Date().toISOString(),
        metadata: {
          ...payment.metadata,
          revolutEvent: event,
          revolutOrderData: orderData,
          webhookReceivedAt: new Date().toISOString(),
        },
      })
      .eq("id", payment.id);

    // Update order payment status
    const orderUpdate: any = {
      payment_status: orderPaymentStatus,
      updated_at: new Date().toISOString(),
    };

    if (orderStatus) {
      orderUpdate.status = orderStatus;
      if (orderStatus === "confirmed") {
        orderUpdate.confirmed_at = new Date().toISOString();
      }
    }

    await supabase
      .from("waiter_orders")
      .update(orderUpdate)
      .eq("id", payment.order_id);

    // Record metrics
    await recordMetric(`payment.revolut.${paymentStatus}`, 1, {
      currency: payment.currency,
    });

    await logStructuredEvent("REVOLUT_WEBHOOK_PROCESSED", {
      paymentId: payment.id,
      orderId: payment.order_id,
      orderToken,
      event,
      status: paymentStatus,
      amount: payment.amount,
      correlationId,
    });

    // TODO: Send notification to user about payment status
    // This could trigger a push notification or email

  } catch (error) {
    await logStructuredEvent("REVOLUT_WEBHOOK_UPDATE_ERROR", {
      error: (error as Error).message,
      orderToken,
      event,
      correlationId,
    });
    throw error;
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
    // Get headers for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("revolut-signature");
    const timestamp = req.headers.get("revolut-request-timestamp");

    await logStructuredEvent("REVOLUT_WEBHOOK_RECEIVED", {
      correlationId,
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
    });

    // Verify signature (per GROUND_RULES.md security requirements)
    const isValid = await verifyRevolutSignature(rawBody, signature, timestamp);
    if (!isValid && Deno.env.get("REVOLUT_ENVIRONMENT") === "production") {
      await logStructuredEvent("REVOLUT_WEBHOOK_INVALID_SIGNATURE", {
        correlationId,
      });

      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse webhook payload
    const payload = JSON.parse(rawBody);
    const { event, order } = payload;

    await logStructuredEvent("REVOLUT_WEBHOOK_PARSED", {
      event,
      orderToken: order?.public_id,
      correlationId,
    });

    // Update payment status
    await updatePaymentStatus(
      order.public_id,
      event,
      order,
      correlationId
    );

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    await logStructuredEvent("REVOLUT_WEBHOOK_ERROR", {
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
