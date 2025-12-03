/**
 * Payment Handler for Marketplace
 * 
 * Integrates payment flow with the AI agent and WhatsApp conversation.
 * Handles text-based payment commands and transaction state management.
 */

import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  initiatePayment,
  buyerConfirmPayment,
  sellerConfirmPayment,
  cancelTransaction,
  getTransactionDetails,
} from "./payment.ts";

export interface PaymentHandlerContext {
  phone: string;
  text: string;
  supabase: SupabaseClient;
}

/**
 * Check if message is a payment-related command
 */
export function isPaymentCommand(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower === "paid" ||
    lower === "payment sent" ||
    lower === "confirm" ||
    lower === "confirm payment" ||
    lower.startsWith("paid ") ||
    lower.startsWith("ref:") ||
    lower.startsWith("reference:") ||
    lower === "cancel transaction" ||
    lower === "cancel purchase"
  );
}

/**
 * Handle payment-related commands
 */
export async function handlePaymentCommand(
  context: PaymentHandlerContext
): Promise<string | null> {
  const { phone, text, supabase } = context;
  const lower = text.toLowerCase().trim();

  // Get user's active transactions
  const { data: transactions } = await supabase.rpc("get_active_transactions", {
    p_phone: phone,
  });

  if (!transactions || transactions.length === 0) {
    return null; // No active transactions, not a payment command
  }

  // Handle "PAID" confirmation
  if (lower === "paid" || lower === "payment sent" || lower === "confirm payment") {
    const buyerTx = transactions.find((t: any) => t.role === "buyer");
    if (!buyerTx) {
      return "You don't have any pending purchases to confirm.";
    }

    const result = await buyerConfirmPayment(
      supabase,
      buyerTx.transaction_id,
      phone
    );

    return result.message;
  }

  // Handle "PAID <reference>" with MoMo transaction ID
  if (lower.startsWith("paid ") || lower.startsWith("ref:") || lower.startsWith("reference:")) {
    const parts = text.split(/\s+/);
    const reference = parts.slice(1).join(" ").trim();
    
    const buyerTx = transactions.find((t: any) => t.role === "buyer");
    if (!buyerTx) {
      return "You don't have any pending purchases to confirm.";
    }

    const result = await buyerConfirmPayment(
      supabase,
      buyerTx.transaction_id,
      phone,
      reference
    );

    // Notify seller
    if (result.success) {
      const sellerMessage = `🔔 *Payment Notification*

Buyer has confirmed payment for: ${buyerTx.listing_title}
Amount: ${buyerTx.agreed_price.toLocaleString()} RWF
${reference ? `Reference: ${reference}` : ""}

Please check your MoMo account and reply:
- "CONFIRM" to confirm receipt
- "DISPUTE" if you haven't received payment

Transaction ID: ${buyerTx.transaction_id}`;

      await sendText(buyerTx.other_party_phone, sellerMessage);
    }

    return result.message;
  }

  // Handle seller confirmation
  if (lower === "confirm" || lower.includes("confirm")) {
    const sellerTx = transactions.find(
      (t: any) => t.role === "seller" && t.status === "confirming"
    );
    
    if (!sellerTx) {
      return "You don't have any payments waiting for confirmation.";
    }

    const result = await sellerConfirmPayment(
      supabase,
      sellerTx.transaction_id,
      phone
    );

    // Notify buyer of completion
    if (result.success) {
      const buyerMessage = `🎉 *Purchase Complete!*

Your purchase has been confirmed!
Item: ${sellerTx.listing_title}
Amount: ${sellerTx.agreed_price.toLocaleString()} RWF

Thank you for using EasyMO Marketplace!`;

      await sendText(sellerTx.other_party_phone, buyerMessage);
    }

    return result.message;
  }

  // Handle cancellation
  if (lower.includes("cancel")) {
    const activeTx = transactions[0];
    const result = await cancelTransaction(
      supabase,
      activeTx.transaction_id,
      phone,
      "User requested cancellation"
    );

    // Notify other party
    if (result.success) {
      const otherPartyMessage = `ℹ️ Transaction cancelled

The ${activeTx.role === "buyer" ? "buyer" : "seller"} has cancelled the transaction for:
${activeTx.listing_title}

The listing is now available again.`;

      await sendText(activeTx.other_party_phone, otherPartyMessage);
    }

    return result.message;
  }

  return null;
}

/**
 * Show user's transaction status
 */
export async function showTransactionStatus(
  phone: string,
  supabase: SupabaseClient
): Promise<string> {
  const { data: transactions } = await supabase.rpc("get_active_transactions", {
    p_phone: phone,
  });

  if (!transactions || transactions.length === 0) {
    return "You have no active transactions.";
  }

  let message = "📊 *Your Active Transactions*\n\n";

  for (const tx of transactions) {
    const role = tx.role === "buyer" ? "Buying" : "Selling";
    const statusEmoji = {
      initiated: "⏳",
      pending: "⌛",
      confirming: "✅",
    }[tx.status] || "📦";

    message += `${statusEmoji} *${role}*: ${tx.listing_title}
Amount: ${tx.agreed_price.toLocaleString()} RWF
Status: ${tx.status}
`;

    if (tx.role === "buyer" && tx.status === "initiated") {
      message += "→ Complete payment and reply 'PAID'\n";
    } else if (tx.role === "buyer" && tx.status === "confirming") {
      message += "→ Waiting for seller confirmation\n";
    } else if (tx.role === "seller" && tx.status === "confirming") {
      message += "→ Reply 'CONFIRM' when you receive payment\n";
    }

    message += "\n";
  }

  message += "Reply 'CANCEL' to cancel a transaction.";
  return message;
}

/**
 * Handle purchase intent from search results
 */
export async function handlePurchaseIntent(
  buyerPhone: string,
  listingId: string,
  supabase: SupabaseClient
): Promise<string> {
  try {
    const result = await initiatePayment(supabase, buyerPhone, listingId);

    // Send messages
    await sendText(buyerPhone, result.message_to_buyer);
    await sendText(
      result.message_to_seller.split("Buyer: ")[1]?.split("...")[0] || "",
      result.message_to_seller
    );

    return "✅ Purchase initiated! Check the message above for payment instructions.";
  } catch (error) {
    return `❌ ${error instanceof Error ? error.message : "Failed to initiate purchase"}`;
  }
}
