// =====================================================
// MOMO WEBHOOK - Payment Status Callback
// =====================================================
// Handles callbacks from MTN MoMo API for payment status updates
// Following GROUND_RULES.md: observability, security, webhook verification
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";

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

  const secret = Deno.env.get("MOMO_WEBHOOK_SECRET");
  const skipVerification = Deno.env.get("MOMO_SKIP_SIGNATURE_VERIFICATION") === "true";

  if (!secret && !skipVerification) {
    await logStructuredEvent("MOMO_WEBHOOK_NO_SECRET", {}, "error");
    return false; // Reject webhook
  }

  if (skipVerification) {
    await logStructuredEvent("MOMO_WEBHOOK_VERIFICATION_SKIPPED", {}, "warn");
    return true;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret!),
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

    // Send notification to user about payment status
    try {
      const { sendWhatsAppMessage } = await import("../_shared/whatsapp-client.ts");
      
      const notificationMessage = paymentStatus === "successful"
        ? `✅ Payment Successful!\n\nYour payment of ${payment.amount} ${payment.currency} has been confirmed.\n\nOrder #${payment.order_id} is now being processed.`
        : `❌ Payment ${paymentStatus === "failed" ? "Failed" : "Pending"}\n\nYour payment of ${payment.amount} ${payment.currency} is ${paymentStatus}.\n\n${reason ? `Reason: ${reason}` : "Please try again or contact support."}`;
      
      // Get user's WhatsApp number from order
      if (payment.waiter_orders?.customer_phone) {
        const config = {
          phoneId: Deno.env.get("WA_PHONE_ID")!,
          accessToken: Deno.env.get("WA_ACCESS_TOKEN")!,
        };
        
        await sendWhatsAppMessage(
          config,
          {
            to: payment.waiter_orders.customer_phone,
            type: "text",
            text: { body: notificationMessage },
          },
          correlationId
        );
        
        await logStructuredEvent("MOMO_NOTIFICATION_SENT", {
          paymentId: payment.id,
          status: paymentStatus,
          phone: payment.waiter_orders.customer_phone,
        });
      }
    } catch (notificationError) {
      // Log but don't fail the webhook if notification fails
      await logStructuredEvent("MOMO_NOTIFICATION_FAILED", {
        error: (notificationError as Error).message,
        paymentId: payment.id,
      }, "warn");
    }



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
    // Rate limiting (50 req/min for payment webhooks)
    const rateLimitCheck = await rateLimitMiddleware(req, {
      limit: 50,
      windowSeconds: 60,
    });

    if (!rateLimitCheck.allowed) {
      await logStructuredEvent("MOMO_WEBHOOK_RATE_LIMITED", {
        correlationId,
        remaining: rateLimitCheck.result.remaining,
      });
      await recordMetric("momo.webhook.rate_limited", 1);
      return rateLimitCheck.response!;
    }

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
    const { referenceId, status, reason } = payload;

    // Validate required fields
    if (!referenceId || !status) {
      await logStructuredEvent("MOMO_WEBHOOK_INVALID_PAYLOAD", {
        hasReferenceId: !!referenceId,
        hasStatus: !!status,
        correlationId,
      });

      return new Response(
        JSON.stringify({ error: "Invalid webhook payload: missing referenceId or status" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
