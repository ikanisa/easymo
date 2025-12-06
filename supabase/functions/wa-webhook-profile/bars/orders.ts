import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendListMessage, sendButtonsMessage, buildButtons } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export const BAR_ORDERS_STATE = "bar_orders";

/**
 * Show orders for a specific bar/restaurant
 */
export async function showBarOrders(
  ctx: RouterContext,
  businessId: string,
  businessName: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Get orders for this bar
  const { data: orders, error } = await ctx.supabase
    .from("orders")
    .select("id, order_number, total_amount, currency, status, visitor_phone, dine_in_table, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("bar_orders.fetch_error", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to load orders.",
      buildButtons({ id: IDS.BACK_MENU, title: "Back" }),
    );
    return true;
  }

  if (!orders || orders.length === 0) {
    await sendButtonsMessage(
      ctx,
      `🛒 *Orders for ${businessName}*\n\nNo orders yet.\n\nOrders will appear here when customers place them via Waiter AI.`,
      buildButtons({ id: IDS.BACK_MENU, title: "Back" }),
    );
    return true;
  }

  const activeOrders = orders.filter(o => 
    ["pending", "received", "preparing"].includes(o.status)
  );
  const completedOrders = orders.filter(o => 
    ["ready", "delivered", "completed"].includes(o.status)
  );

  const rows = activeOrders.map((order) => ({
    id: `order::${order.id}`,
    title: `🔔 #${order.order_number || order.id.substring(0, 8)}`,
    description: `${order.total_amount} ${order.currency || "RWF"} • ${order.status} • Table ${order.dine_in_table || "?"}`,
  }));

  // Add completed orders (limit to 5)
  completedOrders.slice(0, 5).forEach((order) => {
    rows.push({
      id: `order::${order.id}`,
      title: `✅ #${order.order_number || order.id.substring(0, 8)}`,
      description: `${order.total_amount} ${order.currency} • ${order.status}`,
    });
  });

  rows.push({
    id: IDS.BACK_MENU,
    title: "← Back",
    description: "Return to bar management",
  });

  await sendListMessage(
    ctx,
    {
      title: `🛒 Orders - ${businessName}`,
      body: `${activeOrders.length} active • ${completedOrders.length} completed\n\nSelect an order to view details or update status.`,
      sectionTitle: "Orders",
      rows,
      buttonText: "View",
    },
    { emoji: "🛒" },
  );

  return true;
}

/**
 * Show details for a specific order
 */
export async function showOrderDetail(
  ctx: RouterContext,
  orderId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: order, error } = await ctx.supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Order not found.",
      buildButtons({ id: IDS.BACK_MENU, title: "Back" }),
    );
    return true;
  }

  const details = [
    `🛒 *Order #${order.order_number || order.id.substring(0, 8)}*`,
    `\n📍 Table: ${order.dine_in_table || "Not specified"}`,
    `📞 Customer: ${order.visitor_phone || "Unknown"}`,
    `\n💰 Total: ${order.total_amount} ${order.currency || "RWF"}`,
    `📊 Status: ${order.status}`,
    `\n⏰ Placed: ${new Date(order.created_at).toLocaleString()}`,
  ].join("\n");

  const statusActions = [];
  
  if (order.status === "pending") {
    statusActions.push({
      id: IDS.ORDER_STATUS_RECEIVED,
      title: "✅ Mark as Received",
      description: "Acknowledge order",
    });
  }
  
  if (order.status === "received") {
    statusActions.push({
      id: IDS.ORDER_STATUS_PREPARING,
      title: "👨‍🍳 Mark as Preparing",
      description: "Start preparing order",
    });
  }
  
  if (order.status === "preparing") {
    statusActions.push({
      id: IDS.ORDER_STATUS_READY,
      title: "✅ Mark as Ready",
      description: "Order is ready for pickup",
    });
  }
  
  if (order.status === "ready") {
    statusActions.push({
      id: IDS.ORDER_STATUS_DELIVERED,
      title: "🎉 Mark as Delivered",
      description: "Order has been delivered",
    });
  }

  statusActions.push(
    {
      id: IDS.ORDER_STATUS_CANCELLED,
      title: "❌ Cancel Order",
      description: "Cancel this order",
    },
    {
      id: IDS.BACK_MENU,
      title: "← Back",
      description: "Back to orders list",
    }
  );

  await sendListMessage(
    ctx,
    {
      title: "Order Details",
      body: details,
      sectionTitle: "Actions",
      rows: statusActions,
      buttonText: "Select",
    },
    { emoji: "🛒" },
  );

  return true;
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  ctx: RouterContext,
  orderId: string,
  newStatus: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { error } = await ctx.supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId);

  if (error) {
    console.error("bar_orders.update_status_error", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to update order status.",
      buildButtons({ id: IDS.BACK_MENU, title: "Back" }),
    );
    return true;
  }

  await logStructuredEvent("ORDER_STATUS_UPDATED", {
    userId: ctx.profileId,
    orderId,
    newStatus,
  });

  await sendButtonsMessage(
    ctx,
    `✅ Order status updated to: *${newStatus}*`,
    buildButtons(
      { id: `order::${orderId}`, title: "View Order" },
      { id: IDS.BAR_VIEW_ORDERS, title: "All Orders" },
      { id: IDS.BACK_MENU, title: "Done" },
    ),
  );

  return true;
}
