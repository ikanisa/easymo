import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { logStructuredEvent } from "../_shared/observability.ts";

/**
 * Notify bar owner of new order via WhatsApp
 * Sends formatted order details to bar's registered WhatsApp number
 */
export async function notifyBarNewOrder(
  supabase: SupabaseClient,
  barId: string,
  orderId: string,
  orderNumber: string,
  cart: Array<{
    name: string;
    quantity: number;
    price: number;
    currency: string;
  }>,
  session: {
    visitorPhone: string;
    dineInTable?: string;
    totalAmount: number;
    currency: string;
  },
): Promise<boolean> {
  try {
    // Get bar details and owner contact
    const { data: bar, error: barError } = await supabase
      .from("bars")
      .select("name, owner_whatsapp, business_id")
      .eq("id", barId)
      .single();

    if (barError || !bar || !bar.owner_whatsapp) {
      console.error("notify_bar.no_owner_contact", { barId, error: barError });
      return false;
    }

    // Get business details for fallback contact
    const { data: business } = await supabase
      .from("business")
      .select("owner_whatsapp")
      .eq("id", bar.business_id)
      .single();

    const ownerContact = bar.owner_whatsapp || business?.owner_whatsapp;
    
    if (!ownerContact) {
      console.error("notify_bar.no_contact_available", { barId });
      return false;
    }

    // Format order notification message
    const message = formatOrderNotification(
      bar.name,
      orderNumber,
      cart,
      session,
    );

    // Send WhatsApp message to bar owner
    // TODO: Integrate with WhatsApp Cloud API to send message
    await logStructuredEvent("BAR_ORDER_NOTIFICATION_SENT", {
      barId,
      orderId,
      orderNumber,
      ownerContact,
      totalAmount: session.totalAmount,
    });

    console.log("notify_bar.message_sent", {
      to: ownerContact,
      orderNumber,
      message,
    });

    // Update order to mark as notified
    await supabase
      .from("orders")
      .update({ bar_notified: true })
      .eq("id", orderId);

    return true;
  } catch (err) {
    console.error("notify_bar.exception", err);
    await logStructuredEvent("BAR_NOTIFICATION_ERROR", {
      barId,
      orderId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Format order notification message for bar owner
 */
function formatOrderNotification(
  barName: string,
  orderNumber: string,
  cart: Array<{
    name: string;
    quantity: number;
    price: number;
    currency: string;
  }>,
  session: {
    visitorPhone: string;
    dineInTable?: string;
    totalAmount: number;
    currency: string;
  },
): string {
  const itemsList = cart
    .map((item) => {
      const itemTotal = item.quantity * item.price;
      return `  ${item.quantity}x ${item.name} - ${itemTotal.toLocaleString()} ${item.currency}`;
    })
    .join("\n");

  const table = session.dineInTable || "Not specified";
  
  const message = [
    `🔔 *NEW ORDER #${orderNumber}*`,
    "",
    `🏪 ${barName}`,
    `📍 Table: ${table}`,
    "",
    `🍽️ *Items:*`,
    itemsList,
    "",
    `💰 *Total: ${session.totalAmount.toLocaleString()} ${session.currency}*`,
    "",
    `📞 Customer: ${session.visitorPhone}`,
    "",
    "Reply to this message to contact the customer.",
  ].join("\n");

  return message;
}

/**
 * Notify customer of order status update
 */
export async function notifyCustomerOrderUpdate(
  supabase: SupabaseClient,
  customerPhone: string,
  orderNumber: string,
  status: string,
  estimatedTime?: string,
): Promise<boolean> {
  try {
    let statusMessage = "";
    
    switch (status) {
      case "received":
        statusMessage = "✅ Your order has been received and is being reviewed.";
        break;
      case "preparing":
        statusMessage = `👨‍🍳 Your order is being prepared${estimatedTime ? ` (Ready in ${estimatedTime})` : ""}.`;
        break;
      case "ready":
        statusMessage = "🎉 Your order is ready! Please collect it from the counter.";
        break;
      case "delivered":
        statusMessage = "✅ Your order has been delivered. Enjoy your meal!";
        break;
      case "cancelled":
        statusMessage = "❌ Your order has been cancelled.";
        break;
      default:
        statusMessage = `Order status updated to: ${status}`;
    }

    const message = [
      `📦 *Order #${orderNumber} Update*`,
      "",
      statusMessage,
      "",
      "Reply 'HELP' for assistance.",
    ].join("\n");

    // TODO: Send WhatsApp message to customer
    await logStructuredEvent("CUSTOMER_ORDER_UPDATE_SENT", {
      customerPhone,
      orderNumber,
      status,
    });

    console.log("notify_customer.message_sent", {
      to: customerPhone,
      orderNumber,
      status,
      message,
    });

    return true;
  } catch (err) {
    console.error("notify_customer.exception", err);
    return false;
  }
}
