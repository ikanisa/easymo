/**
 * Marketplace Payment Module
 * 
 * Handles USSD-based MoMo payments for marketplace transactions.
 * Uses tap-to-dial tel: links for seamless mobile payment experience.
 * 
 * Payment Flow:
 * 1. Buyer expresses interest in listing
 * 2. System creates transaction record
 * 3. Sends USSD link to buyer (tel:*182*8*1*MERCHANT*AMOUNT#)
 * 4. Buyer taps link → dials USSD → completes MoMo payment
 * 5. Buyer confirms payment in chat
 * 6. Seller confirms receipt
 * 7. Transaction marked complete
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 * @see MOMO_USSD_RESEARCH.md for USSD code structure
 */

import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================
// CONFIGURATION
// =====================================================

// MTN Rwanda MoMo Merchant Configuration
const MOMO_MERCHANT_CODE = Deno.env.get("MOMO_MERCHANT_CODE") || "";
const MOMO_MERCHANT_NAME = Deno.env.get("MOMO_MERCHANT_NAME") || "EasyMO Marketplace";

// USSD Code Structure for Rwanda
// *182*8*1*MERCHANT_CODE*AMOUNT#
const USSD_BASE = "*182*8*1*";  // MTN Rwanda merchant payment prefix

// Transaction Configuration
const TRANSACTION_EXPIRY_HOURS = 24;
const LISTING_RESERVATION_MINUTES = 30;

// =====================================================
// TYPES
// =====================================================

export interface Transaction {
  id: string;
  listing_id: string;
  buyer_phone: string;
  seller_phone: string;
  agreed_price: number;
  status: TransactionStatus;
  payment_method: "momo_ussd" | "cash" | "other";
  merchant_code?: string;
  ussd_code?: string;
  created_at: string;
  expires_at: string;
}

export type TransactionStatus =
  | "initiated"    // Transaction created, payment link sent
  | "pending"      // Buyer acknowledged, payment in progress
  | "confirming"   // Buyer claims sent, awaiting seller confirmation
  | "completed"    // Seller confirmed receipt
  | "disputed"     // Seller disputes payment
  | "cancelled"    // Cancelled by either party
  | "expired";     // Expired without completion

export interface PaymentInitiationResult {
  transaction_id: string;
  ussd_tel_link: string;
  ussd_display_text: string;
  message_to_buyer: string;
  message_to_seller: string;
  expires_at: string;
}

export interface PaymentConfirmationResult {
  success: boolean;
  transaction_status: TransactionStatus;
  message: string;
  next_step?: string;
}

// =====================================================
// USSD HELPERS
// =====================================================

/**
 * Generate USSD code for MoMo merchant payment
 */
function generateMoMoUssd(merchantCode: string, amount: number): string {
  // Format: *182*8*1*MERCHANT_CODE*AMOUNT#
  return `${USSD_BASE}${merchantCode}*${amount}#`;
}

/**
 * Create tap-to-dial tel: link
 * Note: Keep unencoded for better Android compatibility
 */
function createTelLink(ussdCode: string): string {
  return `tel:${ussdCode}`;
}

/**
 * Format USSD code for display (user-friendly)
 */
function formatUssdDisplay(ussdCode: string): string {
  return ussdCode.replace(/\*/g, "*").replace(/#/g, "#");
}

// =====================================================
// PAYMENT INITIATION
// =====================================================

/**
 * Initiate a payment transaction
 */
export async function initiatePayment(
  supabase: SupabaseClient,
  buyerPhone: string,
  listingId: string,
  agreedPrice?: number
): Promise<PaymentInitiationResult> {
  try {
    // 1. Get listing details
    const { data: listing, error: listingError } = await supabase
      .from("marketplace_listings")
      .select("id, title, price, seller_phone, in_transaction, reserved_until")
      .eq("id", listingId)
      .eq("status", "active")
      .single();

    if (listingError || !listing) {
      throw new Error("Listing not found or no longer available");
    }

    // Check if listing is already reserved
    if (listing.in_transaction && listing.reserved_until) {
      const reservedUntil = new Date(listing.reserved_until);
      if (reservedUntil > new Date()) {
        throw new Error("Listing is currently reserved by another buyer");
      }
    }

    // Prevent self-purchase
    if (listing.seller_phone === buyerPhone) {
      throw new Error("You cannot buy your own listing");
    }

    // 2. Determine final price
    const finalPrice = agreedPrice || listing.price;
    if (!finalPrice || finalPrice <= 0) {
      throw new Error("Invalid price for transaction");
    }

    // 3. Validate merchant code
    if (!MOMO_MERCHANT_CODE) {
      throw new Error("Payment system not configured. Please contact support.");
    }

    // 4. Generate USSD code
    const ussdCode = generateMoMoUssd(MOMO_MERCHANT_CODE, finalPrice);
    const telLink = createTelLink(ussdCode);
    const displayUssd = formatUssdDisplay(ussdCode);

    // 5. Create transaction record
    const expiresAt = new Date(Date.now() + TRANSACTION_EXPIRY_HOURS * 60 * 60 * 1000);
    const reserveUntil = new Date(Date.now() + LISTING_RESERVATION_MINUTES * 60 * 1000);

    const { data: transaction, error: txError } = await supabase
      .from("marketplace_transactions")
      .insert({
        listing_id: listingId,
        buyer_phone: buyerPhone,
        seller_phone: listing.seller_phone,
        agreed_price: finalPrice,
        initial_listing_price: listing.price,
        payment_method: "momo_ussd",
        merchant_code: MOMO_MERCHANT_CODE,
        ussd_code: ussdCode,
        status: "initiated",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (txError || !transaction) {
      throw new Error(`Failed to create transaction: ${txError?.message}`);
    }

    // 6. Reserve the listing
    await supabase
      .from("marketplace_listings")
      .update({
        in_transaction: true,
        reserved_by_phone: buyerPhone,
        reserved_until: reserveUntil.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", listingId);

    // 7. Log event
    await logStructuredEvent("PAYMENT_INITIATED", {
      transactionId: transaction.id,
      listingId,
      buyerPhone: buyerPhone.slice(-4),
      sellerPhone: listing.seller_phone.slice(-4),
      amount: finalPrice,
      merchantCode: MOMO_MERCHANT_CODE,
    });

    await recordMetric("marketplace.payment.initiated", 1, {
      payment_method: "momo_ussd",
    });

    // 8. Format messages
    const messageToBuyer = `
📦 *Purchase Confirmation*

*Product*: ${listing.title}
*Amount*: ${finalPrice.toLocaleString()} RWF

💳 *Payment Instructions*:
1. Tap this link to pay: ${telLink}
2. Or manually dial: ${displayUssd}
3. Follow MTN MoMo prompts to complete payment
4. After payment, reply "PAID" with your MoMo transaction ID

⏰ This reservation expires in ${LISTING_RESERVATION_MINUTES} minutes.
Transaction valid for ${TRANSACTION_EXPIRY_HOURS} hours.

Reply "CANCEL" to cancel this purchase.
`.trim();

    const messageToSeller = `
🔔 *New Purchase Request*

A buyer is interested in your listing: *${listing.title}*

*Amount*: ${finalPrice.toLocaleString()} RWF
*Buyer*: ${buyerPhone.slice(-4)}...

They are completing payment now. You'll be notified when payment is confirmed.

Transaction ID: ${transaction.id}
`.trim();

    return {
      transaction_id: transaction.id,
      ussd_tel_link: telLink,
      ussd_display_text: displayUssd,
      message_to_buyer: messageToBuyer,
      message_to_seller: messageToSeller,
      expires_at: expiresAt.toISOString(),
    };
  } catch (error) {
    await logStructuredEvent(
      "PAYMENT_INITIATION_ERROR",
      {
        listingId,
        buyerPhone: buyerPhone.slice(-4),
        error: error instanceof Error ? error.message : String(error),
      },
      "error"
    );

    throw error;
  }
}

// =====================================================
// PAYMENT CONFIRMATION
// =====================================================

/**
 * Buyer confirms they've completed payment
 */
export async function buyerConfirmPayment(
  supabase: SupabaseClient,
  transactionId: string,
  buyerPhone: string,
  momoReference?: string
): Promise<PaymentConfirmationResult> {
  try {
    // 1. Get transaction
    const { data: transaction, error: txError } = await supabase
      .from("marketplace_transactions")
      .select("*, marketplace_listings(title, seller_phone)")
      .eq("id", transactionId)
      .eq("buyer_phone", buyerPhone)
      .single();

    if (txError || !transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.status === "completed") {
      return {
        success: true,
        transaction_status: "completed",
        message: "✅ This transaction is already completed!",
      };
    }

    if (!["initiated", "pending"].includes(transaction.status)) {
      throw new Error(`Cannot confirm payment in status: ${transaction.status}`);
    }

    // 2. Update transaction to confirming
    const { error: updateError } = await supabase
      .from("marketplace_transactions")
      .update({
        status: "confirming",
        payment_reference: momoReference || "User confirmed",
        buyer_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (updateError) {
      throw new Error(`Failed to update transaction: ${updateError.message}`);
    }

    // 3. Log event
    await logStructuredEvent("PAYMENT_BUYER_CONFIRMED", {
      transactionId,
      buyerPhone: buyerPhone.slice(-4),
      reference: momoReference,
    });

    return {
      success: true,
      transaction_status: "confirming",
      message: `✅ Payment confirmation received!${momoReference ? `\nReference: ${momoReference}` : ""}
      
The seller will be notified to confirm receipt. You'll get a notification when confirmed.`,
      next_step: "await_seller_confirmation",
    };
  } catch (error) {
    await logStructuredEvent(
      "PAYMENT_BUYER_CONFIRM_ERROR",
      {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
      },
      "error"
    );

    return {
      success: false,
      transaction_status: "pending",
      message: `❌ ${error instanceof Error ? error.message : "Failed to confirm payment"}`,
    };
  }
}

/**
 * Seller confirms they've received payment
 */
export async function sellerConfirmPayment(
  supabase: SupabaseClient,
  transactionId: string,
  sellerPhone: string
): Promise<PaymentConfirmationResult> {
  try {
    // 1. Get transaction
    const { data: transaction, error: txError } = await supabase
      .from("marketplace_transactions")
      .select("*, marketplace_listings(id, title)")
      .eq("id", transactionId)
      .eq("seller_phone", sellerPhone)
      .single();

    if (txError || !transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.status === "completed") {
      return {
        success: true,
        transaction_status: "completed",
        message: "✅ This transaction is already completed!",
      };
    }

    if (transaction.status !== "confirming") {
      throw new Error(`Cannot confirm in status: ${transaction.status}. Buyer must confirm first.`);
    }

    // 2. Complete transaction
    const { error: updateError } = await supabase
      .from("marketplace_transactions")
      .update({
        status: "completed",
        seller_confirmed_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (updateError) {
      throw new Error(`Failed to update transaction: ${updateError.message}`);
    }

    // 3. Mark listing as sold
    await supabase
      .from("marketplace_listings")
      .update({
        status: "sold",
        in_transaction: false,
        reserved_by_phone: null,
        reserved_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.listing_id);

    // 4. Log event
    await logStructuredEvent("PAYMENT_COMPLETED", {
      transactionId,
      listingId: transaction.listing_id,
      amount: transaction.agreed_price,
    });

    await recordMetric("marketplace.payment.completed", 1, {
      payment_method: "momo_ussd",
    });

    return {
      success: true,
      transaction_status: "completed",
      message: `🎉 Transaction completed!

Payment confirmed: ${transaction.agreed_price.toLocaleString()} RWF
Item: ${transaction.marketplace_listings.title}

Thank you for using EasyMO Marketplace!`,
    };
  } catch (error) {
    await logStructuredEvent(
      "PAYMENT_SELLER_CONFIRM_ERROR",
      {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
      },
      "error"
    );

    return {
      success: false,
      transaction_status: "confirming",
      message: `❌ ${error instanceof Error ? error.message : "Failed to confirm payment"}`,
    };
  }
}

// =====================================================
// TRANSACTION MANAGEMENT
// =====================================================

/**
 * Cancel a transaction
 */
export async function cancelTransaction(
  supabase: SupabaseClient,
  transactionId: string,
  userPhone: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { data: transaction, error: txError } = await supabase
      .from("marketplace_transactions")
      .select("*")
      .eq("id", transactionId)
      .or(`buyer_phone.eq.${userPhone},seller_phone.eq.${userPhone}`)
      .single();

    if (txError || !transaction) {
      throw new Error("Transaction not found");
    }

    if (!["initiated", "pending"].includes(transaction.status)) {
      throw new Error(`Cannot cancel transaction in status: ${transaction.status}`);
    }

    // Update transaction
    await supabase
      .from("marketplace_transactions")
      .update({
        status: "cancelled",
        admin_notes: reason || `Cancelled by ${userPhone === transaction.buyer_phone ? "buyer" : "seller"}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    // Release listing
    await supabase
      .from("marketplace_listings")
      .update({
        in_transaction: false,
        reserved_by_phone: null,
        reserved_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.listing_id);

    await logStructuredEvent("TRANSACTION_CANCELLED", {
      transactionId,
      cancelledBy: userPhone.slice(-4),
      reason,
    });

    return {
      success: true,
      message: "✅ Transaction cancelled successfully. Listing is now available again.",
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ ${error instanceof Error ? error.message : "Failed to cancel transaction"}`,
    };
  }
}

/**
 * Get transaction details
 */
export async function getTransactionDetails(
  supabase: SupabaseClient,
  transactionId: string,
  userPhone: string
): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from("marketplace_transactions")
    .select("*")
    .eq("id", transactionId)
    .or(`buyer_phone.eq.${userPhone},seller_phone.eq.${userPhone}`)
    .single();

  if (error) {
    await logStructuredEvent(
      "TRANSACTION_FETCH_ERROR",
      { transactionId, error: error.message },
      "error"
    );
    return null;
  }

  return data;
}
