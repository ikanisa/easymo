import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";

const WA_ACCESS_TOKEN = Deno.env.get("WA_ACCESS_TOKEN");
const WA_PHONE_NUMBER_ID = Deno.env.get("WA_PHONE_NUMBER_ID");

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Session {
  bar_info?: {
    name: string;
    phone: string;
    currency: string;
  };
  table_number: string | null;
}

/**
 * Notify bar/restaurant of a new order via WhatsApp
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
  cart: { items: CartItem[]; total: number },
  session: Session
): Promise<boolean> {
  try {
    const { data: bar } = await supabase
      .from("bars")
      .select("phone, name, owner_phone")
      .eq("id", barId)
      .single();

    if (!bar) {
      console.error("notify_bar: Bar not found", { barId });
      return false;
    }

    const barPhone = bar.owner_phone || bar.phone;
    if (!barPhone) {
      console.error("notify_bar: No phone number for bar", { barId });
      return false;
    }

    const itemsList = cart.items
      .map((item) => `  ${item.quantity}x ${item.name} - ${(item.price * item.quantity).toLocaleString()}`)
      .join("\n");

    const currency = session.bar_info?.currency || "RWF";
    const tableInfo = session.table_number ? `📍 Table: ${session.table_number}` : "📍 Table: Not specified";

    const message = `🔔 *NEW ORDER #${orderNumber}*\n\n${tableInfo}\n\n🍽️ *Items:*\n${itemsList}\n\n💰 *Total: ${cart.total.toLocaleString()} ${currency}*\n\n⏰ ${new Date().toLocaleTimeString()}\n\n---\nReply with order number to update status.`;

    await sendWhatsAppMessage(barPhone, message);

    await supabase
      .from("orders")
      .update({
        bar_notified: true,
        bar_notification_sent_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    await logStructuredEvent("BAR_NOTIFIED_NEW_ORDER", {
      barId,
      orderId,
      orderNumber,
      barPhone,
      itemCount: cart.items.length,
      total: cart.total,
    });

    return true;
  } catch (error) {
    console.error("notify_bar.error", error);
    await logStructuredEvent("BAR_NOTIFICATION_FAILED", {
      barId,
      orderId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
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

    // STUB: WhatsApp message sending not implemented
    // In production, this should:
    // - Use WhatsApp Cloud API to send message
    // - Handle delivery failures and retries
    // - Track message status
    // For now, we log the intent
    console.log("notify_bar.stub_message", {
      to: ownerContact,
      orderNumber,
      message,
      warning: "WhatsApp sending not implemented - message logged only",
    });

    await logStructuredEvent("BAR_ORDER_NOTIFICATION_LOGGED", {
      barId,
      orderId,
      orderNumber,
      ownerContact,
      totalAmount: session.totalAmount,
      status: "stub_only",
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
 * Send WhatsApp message via Meta API
 */
async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
  if (!WA_ACCESS_TOKEN || !WA_PHONE_NUMBER_ID) {
    console.error("WhatsApp credentials not configured");
    return false;
  }

  let phone = to.replace(/\D/g, "");
  if (!phone.startsWith("250") && phone.length === 9) {
    phone = "250" + phone;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WA_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: { body: text },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("WhatsApp send failed:", errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error("WhatsApp send error:", error);
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
