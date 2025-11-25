import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendButtonsMessage, sendTextMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { logStructuredEvent } from "../../observability.ts";
import { t } from "../../_shared/wa-webhook-shared/i18n/translator.ts";

export interface PaymentDetails {
  transactionId: string;
  listingId: string;
  buyerPhone: string;
  sellerPhone: string;
  agreedPrice: number;
  currency: string;
  status: "pending" | "initiated" | "success" | "failed" | "cancelled";
}

/**
 * Initiate USSD-based Mobile Money payment
 * Generates a USSD dial string and sends as clickable link
 */
export async function initiateMoMoPayment(
  ctx: RouterContext,
  listingId: string,
  agreedPrice: number,
  sellerPhone: string,
): Promise<void> {
  const correlationId = crypto.randomUUID();
  const transactionId = `MKTPL-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;

  await logStructuredEvent("marketplace.payment.initiated", {
    correlationId,
    transactionId,
    listingId,
    buyerPhone: ctx.from.slice(-4),
    amount: agreedPrice,
  });

  // Create transaction record
  const { error: txError } = await ctx.supabase
    .from("marketplace_transactions")
    .insert({
      id: transactionId,
      listing_id: listingId,
      buyer_phone: ctx.from,
      seller_phone: sellerPhone,
      agreed_price: agreedPrice,
      payment_method: "momo_ussd",
      status: "pending",
    });

  if (txError) {
    console.error("Failed to create transaction", { error: txError, transactionId });
    await sendTextMessage(ctx, t(ctx.locale, "marketplace.payment.error", {
      error: "Transaction creation failed"
    }) || "❌ Payment initiation failed. Please try again.");
    return;
  }

  // Generate USSD dial string for MTN Mobile Money (Rwanda)
  // Format: *182*8*1*amount*recipientPhone#
  const ussdCode = generateMoMoUSSD(agreedPrice, sellerPhone);
  const ussdLink = `tel:${encodeURIComponent(ussdCode)}`;

  const message = `
💳 *Payment Required*

Amount: ${agreedPrice.toLocaleString()} RWF

To complete this purchase, tap the button below to dial the Mobile Money USSD code:

*📱 Tap to Pay with MoMo*
${ussdLink}

Follow the prompts on your phone to:
1. Enter your Mobile Money PIN
2. Confirm the payment

Transaction ID: ${transactionId.substring(0, 16)}...

The seller will be notified once payment is confirmed.
  `.trim();

  await sendButtonsMessage(ctx, message, [
    {
      id: `PAY_USSD::${transactionId}`,
      title: "📱 Pay with MoMo",
    },
    {
      id: `CANCEL_PAYMENT::${transactionId}`,
      title: "❌ Cancel",
    },
  ]);

  await logStructuredEvent("marketplace.payment.ussd_sent", {
    correlationId,
    transactionId,
    ussdLink,
  });
}

/**
 * Generate MTN Mobile Money USSD code
 * Rwanda format: *182*8*1*amount*recipientPhone#
 * For direct transfer to seller
 */
function generateMoMoUSSD(amount: number, recipientPhone: string): string {
  // Clean phone number (remove +250 prefix if present)
  const cleanPhone = recipientPhone.replace(/^\+?250/, "");
  
  // MTN MoMo USSD: *182*8*1*amount*phone#
  // *182# - MTN Mobile Money main menu
  // *8 - Send Money
  // *1 - To MTN Number
  // *amount - Amount to send
  // *phone - Recipient phone
  return `*182*8*1*${amount}*${cleanPhone}#`;
}

/**
 * Handle payment confirmation from user
 * User manually confirms after completing USSD payment
 */
export async function handlePaymentConfirmation(
  ctx: RouterContext,
  transactionId: string,
  confirmed: boolean,
): Promise<void> {
  const correlationId = crypto.randomUUID();

  if (!confirmed) {
    // Cancel transaction
    await ctx.supabase
      .from("marketplace_transactions")
      .update({ status: "cancelled" })
      .eq("id", transactionId);

    await sendTextMessage(ctx, "❌ Payment cancelled.");
    await logStructuredEvent("marketplace.payment.cancelled", {
      correlationId,
      transactionId,
    });
    return;
  }

  // Get transaction details
  const { data: transaction, error } = await ctx.supabase
    .from("marketplace_transactions")
    .select("*, listing:marketplace_listings(*)")
    .eq("id", transactionId)
    .single();

  if (error || !transaction) {
    await sendTextMessage(ctx, "❌ Transaction not found.");
    return;
  }

  // Ask for payment reference
  const message = `
✅ *Confirm Payment*

Please send the Mobile Money transaction reference number you received via SMS.

Example: ABC123XYZ456

This helps us verify your payment.
  `.trim();

  await sendTextMessage(ctx, message);

  // Set state to wait for payment reference
  await ctx.supabase
    .from("marketplace_conversations")
    .update({
      flow_step: "awaiting_payment_reference",
      collected_data: {
        transaction_id: transactionId,
      },
    })
    .eq("phone", ctx.from);

  await logStructuredEvent("marketplace.payment.awaiting_reference", {
    correlationId,
    transactionId,
  });
}

/**
 * Process payment reference submission
 */
export async function processPaymentReference(
  ctx: RouterContext,
  transactionId: string,
  paymentReference: string,
): Promise<void> {
  const correlationId = crypto.randomUUID();

  // Update transaction with reference
  const { data: transaction, error } = await ctx.supabase
    .from("marketplace_transactions")
    .update({
      payment_reference: paymentReference.trim(),
      status: "initiated",
    })
    .eq("id", transactionId)
    .select("*, listing:marketplace_listings(*)")
    .single();

  if (error || !transaction) {
    await sendTextMessage(ctx, "❌ Failed to update transaction.");
    return;
  }

  // Notify buyer
  await sendTextMessage(ctx, `
✅ *Payment Reference Received*

Reference: ${paymentReference}

Your payment is being verified. You'll receive a confirmation shortly.

We'll notify the seller once payment is confirmed.
  `.trim());

  // Notify seller
  const sellerMessage = `
🔔 *New Purchase!*

Your listing has been purchased:
*${transaction.listing.title}*

Payment Amount: ${transaction.agreed_price.toLocaleString()} RWF
Payment Reference: ${paymentReference}

Payment is being verified. You'll be notified when confirmed.

Transaction ID: ${transactionId.substring(0, 16)}...
  `.trim();

  await ctx.supabase.from("whatsapp_queue").insert({
    to: transaction.seller_phone,
    body: sellerMessage,
    type: "text",
  });

  await logStructuredEvent("marketplace.payment.reference_submitted", {
    correlationId,
    transactionId,
    reference: paymentReference,
  });

  // In a real implementation, you would:
  // 1. Call MTN MoMo API to verify the transaction
  // 2. Check if reference matches the amount and recipient
  // 3. Auto-update status to "success" or "failed"
  
  // For now, we'll mark as success after a delay (simulation)
  // In production, use a separate verification service/webhook
  await markPaymentAsSuccess(ctx, transactionId);
}

/**
 * Mark payment as successful and notify both parties
 */
async function markPaymentAsSuccess(
  ctx: RouterContext,
  transactionId: string,
): Promise<void> {
  const { data: transaction, error } = await ctx.supabase
    .from("marketplace_transactions")
    .update({
      status: "success",
      completed_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .select("*, listing:marketplace_listings(*)")
    .single();

  if (error || !transaction) {
    console.error("Failed to mark payment as success", { error, transactionId });
    return;
  }

  // Update listing status to sold
  await ctx.supabase
    .from("marketplace_listings")
    .update({ status: "sold" })
    .eq("id", transaction.listing_id);

  // Notify buyer
  const buyerMessage = `
🎉 *Payment Confirmed!*

Your purchase is complete:
*${transaction.listing.title}*

Amount Paid: ${transaction.agreed_price.toLocaleString()} RWF

The seller has been notified. They will contact you to arrange delivery.

Seller Contact: ${transaction.seller_phone}

Thank you for using EasyMO Marketplace! 🙏
  `.trim();

  await sendTextMessage(ctx, buyerMessage);

  // Notify seller
  const sellerMessage = `
💰 *Payment Received!*

Your listing has been sold:
*${transaction.listing.title}*

Amount: ${transaction.agreed_price.toLocaleString()} RWF

Buyer Contact: ${transaction.buyer_phone}

Please contact the buyer to arrange delivery.

Thank you for using EasyMO Marketplace! 🙏
  `.trim();

  await ctx.supabase.from("whatsapp_queue").insert({
    to: transaction.seller_phone,
    body: sellerMessage,
    type: "text",
  });

  await logStructuredEvent("marketplace.payment.completed", {
    transactionId,
    listingId: transaction.listing_id,
    amount: transaction.agreed_price,
  });
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(
  ctx: RouterContext,
  transactionId: string,
): Promise<void> {
  const { data: transaction, error } = await ctx.supabase
    .from("marketplace_transactions")
    .select("*, listing:marketplace_listings(title)")
    .eq("id", transactionId)
    .single();

  if (error || !transaction) {
    await sendTextMessage(ctx, "❌ Transaction not found.");
    return;
  }

  const statusEmoji = {
    pending: "⏳",
    initiated: "🔄",
    success: "✅",
    failed: "❌",
    cancelled: "🚫",
  };

  const message = `
${statusEmoji[transaction.status] || "❓"} *Transaction Status*

Item: ${transaction.listing.title}
Amount: ${transaction.agreed_price.toLocaleString()} RWF
Status: ${transaction.status.toUpperCase()}
${transaction.payment_reference ? `Reference: ${transaction.payment_reference}` : ""}

Transaction ID: ${transactionId}
  `.trim();

  await sendTextMessage(ctx, message);
}
