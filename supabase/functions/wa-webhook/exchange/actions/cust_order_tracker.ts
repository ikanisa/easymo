import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { ensureCustomer, listCustomerOrders, orderTimeline } from "../helpers.ts";
import { fmtCurrency } from "../../utils/text.ts";

export async function handleCustomerOrderTracker(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_refresh_orders":
      return await refreshOrders(req);
    case "a_open_order":
      return await openOrder(req);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{ level: "warning", text: `Unknown action ${req.action_id}` }],
      };
  }
}

async function refreshOrders(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const customer = await ensureCustomer(req.wa_id);
  const orders = await listCustomerOrders(customer.id);
  return {
    next_screen_id: "s_orders_list",
    data: {
      orders: orders.map((order) => ({
        id: order.id,
        title: `#${order.order_code} — ${order.status}`,
        description: fmtCurrency(order.total_minor ?? 0, order.currency ?? "RWF"),
      })),
    },
  };
}

async function openOrder(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const orderId = typeof req.fields?.order_id === "string" ? req.fields.order_id : undefined;
  if (!orderId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing order" }],
    };
  }
  const orders = await listCustomerOrders((await ensureCustomer(req.wa_id)).id);
  const order = orders.find((o) => o.id === orderId);
  const timeline = await orderTimeline(orderId);
  return {
    next_screen_id: "s_order_detail",
    data: {
      order_id: orderId,
      status: order?.status ?? "",
      timeline_text: timeline,
    },
  };
}
