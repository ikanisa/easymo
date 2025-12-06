import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendListMessage, sendButtonsMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export const BAR_ORDERS_STATE = "bar_orders";
export const ORDER_DETAIL_STATE = "order_detail";

type OrderStatus = "pending" | "preparing" | "ready" | "served" | "cancelled";

interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  currency: string;
  visitor_phone: string | null;
  dine_in_table: string | null;
  payment_status: string;
  created_at: string;
  items?: OrderItem[];
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

const STATUS_ICONS: Record<OrderStatus, string> = {
  pending: "🟡",
  preparing: "🔵",
  ready: "🟢",
  served: "✅",
  cancelled: "❌",
};

/**
 * Show orders for a bar/restaurant
 */
export async function showBarOrders(
  ctx: RouterContext,
  businessId: string,
  businessName: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Fetch active orders (pending, preparing, ready)
  const { data: orders, error } = await ctx.supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      total_amount,
      currency,
      visitor_phone,
      dine_in_table,
      payment_status,
      created_at,
      order_items (
        id,
        name,
        quantity,
        price
      )
    `)
    .eq("business_id", businessId)
    .in("status", ["pending", "preparing", "ready"])
    .order("created_at", { ascending: false })
    .limit(15);

  if (error) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to load orders.",
      [{ id: `bar::${businessId}`, title: "← Back" }]
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: BAR_ORDERS_STATE,
    data: { businessId, businessName },
  });

  if (!orders || orders.length === 0) {
    await sendButtonsMessage(
      ctx,
      `📦 *Orders for ${businessName}*\n\nNo active orders right now.\n\nOrders will appear here when customers order via WhatsApp.`,
      [
        { id: IDS.BAR_VIEW_ORDER_HISTORY, title: "📜 Order History" },
        { id: `bar::${businessId}`, title: "← Back" },
      ]
    );
    return true;
  }

  const rows = orders.map((order: Order) => {
    const statusIcon = STATUS_ICONS[order.status] || "⚪";
    const table = order.dine_in_table ? `Table ${order.dine_in_table}` : "";
    const items = (order as any).order_items?.length || 0;
    
    return {
      id: `order::${order.id}`,
      title: `${statusIcon} #${order.order_number}`.slice(0, 24),
      description: `${items} items • ${order.total_amount.toLocaleString()} ${order.currency} ${table}`.slice(0, 72),
    };
  });

  rows.push({
    id: IDS.BAR_VIEW_ORDER_HISTORY,
    title: "📜 Order History",
    description: "View past orders",
  });

  rows.push({
    id: `bar::${businessId}`,
    title: "← Back",
    description: "Return to venue menu",
  });

  // Count by status
  const pending = orders.filter((o: Order) => o.status === "pending").length;
  const preparing = orders.filter((o: Order) => o.status === "preparing").length;
  const ready = orders.filter((o: Order) => o.status === "ready").length;

  await sendListMessage(ctx, {
    title: `📦 ${businessName} Orders`,
    body: `*Active Orders*\n\n🟡 Pending: ${pending}\n🔵 Preparing: ${preparing}\n🟢 Ready: ${ready}\n\nTap an order to view details:`,
    sectionTitle: "Orders",
    buttonText: "Select Order",
    rows,
  });

  return true;
}

/**
 * Show order detail with management options
 */
export async function showOrderDetail(
  ctx: RouterContext,
  orderId: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: order, error } = await ctx.supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      total_amount,
      currency,
      visitor_phone,
      dine_in_table,
      payment_status,
      payment_method,
      created_at,
      special_instructions,
      business_id,
      order_items (
        id,
        name,
        quantity,
        price
      )
    `)
    .eq("id", orderId)
    .single();

  if (error || !order) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Order not found.",
      [{ id: IDS.BAR_VIEW_ORDERS, title: "← Back" }]
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: ORDER_DETAIL_STATE,
    data: { orderId, businessId: order.business_id },
  });

  const statusIcon = STATUS_ICONS[order.status as OrderStatus] || "⚪";
  const items = (order as any).order_items || [];
  
  let itemsList = items.map((item: OrderItem) => 
    `  ${item.quantity}x ${item.name} - ${item.price.toLocaleString()}`
  ).join("\n");

  const paymentIcon = order.payment_status === "paid" ? "✅" : "⏳";
  const tableInfo = order.dine_in_table ? `📍 Table: ${order.dine_in_table}\n` : "";
  const customerInfo = order.visitor_phone ? `👤 ${order.visitor_phone}\n` : "";
  const instructions = order.special_instructions ? `\n📝 Note: ${order.special_instructions}` : "";

  const detail = 
    `${statusIcon} *Order #${order.order_number}*\n\n` +
    `${tableInfo}${customerInfo}` +
    `${paymentIcon} Payment: ${order.payment_status}\n` +
    `⏰ ${new Date(order.created_at).toLocaleString()}\n\n` +
    `*Items:*\n${itemsList}\n\n` +
    `💰 *Total: ${order.total_amount.toLocaleString()} ${order.currency}*${instructions}`;

  // Build action buttons based on current status
  const rows: any[] = [];
  
  switch (order.status) {
    case "pending":
      rows.push({ id: `status::${orderId}::preparing`, title: "🔵 Start Preparing", description: "Mark as being prepared" });
      break;
    case "preparing":
      rows.push({ id: `status::${orderId}::ready`, title: "🟢 Mark Ready", description: "Food/drinks are ready" });
      break;
    case "ready":
      rows.push({ id: `status::${orderId}::served`, title: "✅ Mark Served", description: "Order has been served" });
      break;
  }

  if (order.status !== "cancelled" && order.status !== "served") {
    rows.push({ id: `status::${orderId}::cancelled`, title: "❌ Cancel Order", description: "Cancel this order" });
  }

  if (order.visitor_phone) {
    rows.push({ id: `contact::${order.visitor_phone}`, title: "💬 Message Customer", description: "Send WhatsApp message" });
  }

  rows.push({ id: IDS.BAR_VIEW_ORDERS, title: "← Back to Orders", description: "Return to order list" });

  await sendListMessage(ctx, {
    title: `Order #${order.order_number}`,
    body: detail,
    sectionTitle: "Actions",
    buttonText: "Select Action",
    rows,
  });

  return true;
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  ctx: RouterContext,
  orderId: string,
  newStatus: OrderStatus
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: order } = await ctx.supabase
    .from("orders")
    .select("order_number, visitor_phone, business_id")
    .eq("id", orderId)
    .single();

  if (!order) return false;

  const { error } = await ctx.supabase
    .from("orders")
    .update({ 
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to update order status.",
      [{ id: `order::${orderId}`, title: "← Back" }]
    );
    return true;
  }

  await logStructuredEvent("ORDER_STATUS_UPDATED", {
    userId: ctx.profileId,
    orderId,
    orderNumber: order.order_number,
    newStatus,
  });

  // Optionally notify customer
  if (order.visitor_phone && (newStatus === "ready" || newStatus === "cancelled")) {
    await notifyCustomerStatusChange(order.visitor_phone, order.order_number, newStatus);
  }

  const statusIcon = STATUS_ICONS[newStatus];
  
  await sendButtonsMessage(
    ctx,
    `${statusIcon} Order #${order.order_number} is now *${newStatus.toUpperCase()}*`,
    [
      { id: `order::${orderId}`, title: "👁️ View Order" },
      { id: IDS.BAR_VIEW_ORDERS, title: "📦 All Orders" },
    ]
  );

  return true;
}

/**
 * Notify customer of status change
 */
async function notifyCustomerStatusChange(
  customerPhone: string,
  orderNumber: string,
  status: OrderStatus
): Promise<void> {
  // This would send a WhatsApp message to the customer
  console.log(`Notify ${customerPhone}: Order #${orderNumber} is ${status}`);
  
  const WA_ACCESS_TOKEN = Deno.env.get("WA_ACCESS_TOKEN");
  const WA_PHONE_NUMBER_ID = Deno.env.get("WA_PHONE_NUMBER_ID");

  if (!WA_ACCESS_TOKEN || !WA_PHONE_NUMBER_ID) return;

  let message = "";
  switch (status) {
    case "ready":
      message = `🟢 *Your order is ready!*\n\nOrder #${orderNumber}\n\nPlease come to the counter to collect your order.`;
      break;
    case "cancelled":
      message = `❌ *Order Cancelled*\n\nOrder #${orderNumber}\n\nSorry, your order has been cancelled. Please contact us if you have questions.`;
      break;
    default:
      return;
  }

  try {
    await fetch(
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
          to: customerPhone,
          type: "text",
          text: { body: message },
        }),
      }
    );
  } catch (error) {
    console.error("Failed to notify customer:", error);
  }
}

/**
 * View order history
 */
export async function showOrderHistory(
  ctx: RouterContext,
  businessId: string,
  businessName: string,
  page: number = 0
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const pageSize = 10;
  const offset = page * pageSize;

  const { data: orders, error } = await ctx.supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      total_amount,
      currency,
      created_at
    `)
    .eq("business_id", businessId)
    .in("status", ["served", "cancelled"])
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to load order history.",
      [{ id: IDS.BAR_VIEW_ORDERS, title: "← Back to Active" }]
    );
    return true;
  }

  if (!orders || orders.length === 0) {
    await sendButtonsMessage(
      ctx,
      `📜 *Order History for ${businessName}*\n\nNo past orders found.`,
      [{ id: IDS.BAR_VIEW_ORDERS, title: "← Back to Active" }]
    );
    return true;
  }

  const rows = orders.map((order) => {
    const statusIcon = STATUS_ICONS[order.status as OrderStatus];
    const date = new Date(order.created_at).toLocaleDateString();
    
    return {
      id: `order::${order.id}`,
      title: `${statusIcon} #${order.order_number}`.slice(0, 24),
      description: `${date} • ${order.total_amount.toLocaleString()} ${order.currency}`.slice(0, 72),
    };
  });

  if (orders.length === pageSize) {
    rows.push({
      id: `history_page::${page + 1}`,
      title: "▶️ Next Page",
      description: "Show older orders",
    });
  }

  if (page > 0) {
    rows.push({
      id: `history_page::${page - 1}`,
      title: "◀️ Previous Page",
      description: "Show newer orders",
    });
  }

  rows.push({
    id: IDS.BAR_VIEW_ORDERS,
    title: "← Back to Active",
    description: "Return to active orders",
  });

  await sendListMessage(ctx, {
    title: `📜 ${businessName} Order History`,
    body: `Past orders (page ${page + 1}):`,
    sectionTitle: "History",
    buttonText: "View Details",
    rows,
  });

  return true;
}
