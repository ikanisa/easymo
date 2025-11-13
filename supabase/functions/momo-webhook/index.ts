// =====================================================
// MOMO WEBHOOK - Payment Status Callback
// =====================================================
// Handles callbacks from MTN MoMo API for payment status updates
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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
};

// =====================================================
// WEBHOOK SIGNATURE VERIFICATION
// =====================================================

async function verifyMoMoSignature(
  payload: string,
  signature: string | null
): Promise<boolean> {
  if (!signature) {
    return false; // No signature provided
  }

  const secret = Deno.env.get("MOMO_WEBHOOK_SECRET") || "";
  if (!secret) {
    // In sandbox mode without secret, skip verification
    return true;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );

    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    return expectedSignature === signature;
  } catch (error) {
    await logStructuredEvent("MOMO_WEBHOOK_SIGNATURE_ERROR", {
      error: (error as Error).message,
    });
    return false;
  }
}

// =====================================================
// PAYMENT STATUS UPDATE
// =====================================================

async function updatePaymentStatus(
  referenceId: string,
  status: string,
  reason?: string,
  correlationId?: string
): Promise<void> {
  try {
    // Get payment by transaction ID
    const { data: payment, error: paymentError } = await supabase
      .from("waiter_payments")
      .select("*, waiter_orders(*)")
      .eq("provider_transaction_id", referenceId)
      .single();

    if (paymentError || !payment) {
      await logStructuredEvent("MOMO_WEBHOOK_PAYMENT_NOT_FOUND", {
        referenceId,
        status,
        correlationId,
      });
      return;
    }

    // Map MoMo status to our status
    let paymentStatus: string;
    let orderPaymentStatus: string;
    let orderStatus: string | undefined;

    switch (status.toUpperCase()) {
      case "SUCCESSFUL":
        paymentStatus = "successful";
        orderPaymentStatus = "successful";
        orderStatus = "confirmed";
        break;
      case "FAILED":
        paymentStatus = "failed";
        orderPaymentStatus = "failed";
        break;
      case "PENDING":
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
          momoStatus: status,
          reason,
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
    await recordMetric(`payment.momo.${paymentStatus}`, 1, {
      currency: payment.currency,
    });

    await logStructuredEvent("MOMO_WEBHOOK_PROCESSED", {
      paymentId: payment.id,
      orderId: payment.order_id,
      referenceId,
      status: paymentStatus,
      amount: payment.amount,
      correlationId,
    });

    // TODO: Send notification to user about payment status
    // This could trigger a push notification or SMS

  } catch (error) {
    await logStructuredEvent("MOMO_WEBHOOK_UPDATE_ERROR", {
      error: (error as Error).message,
      referenceId,
      status,
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
    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-momo-signature");

    await logStructuredEvent("MOMO_WEBHOOK_RECEIVED", {
      correlationId,
      hasSignature: !!signature,
    });

    // Verify signature (per GROUND_RULES.md security requirements)
    const isValid = await verifyMoMoSignature(rawBody, signature);
    if (!isValid && Deno.env.get("MOMO_ENVIRONMENT") === "production") {
      await logStructuredEvent("MOMO_WEBHOOK_INVALID_SIGNATURE", {
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
    const { referenceId, status, reason, financialTransactionId } = payload;

    await logStructuredEvent("MOMO_WEBHOOK_PARSED", {
      referenceId,
      status,
      reason,
      correlationId,
    });

    // Update payment status
    await updatePaymentStatus(referenceId, status, reason, correlationId);

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
    await logStructuredEvent("MOMO_WEBHOOK_ERROR", {
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
