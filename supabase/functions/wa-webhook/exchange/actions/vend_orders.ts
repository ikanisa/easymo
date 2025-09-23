import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { fmtCurrency } from "../../utils/text.ts";
import { notifyCustomerStatus } from "../../notify/hooks.ts";

export async function handleVendorOrders(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_view_queue":
    case "a_refresh":
      return await listQueue(req);
    case "a_open_order_detail":
      return await openOrder(req);
    case "a_mark_paid":
      return await markStatus(req, "paid");
    case "a_mark_served":
      return await markStatus(req, "served");
    case "a_confirm_cancel":
      return await markStatus(req, "cancelled");
    default:
      return unknown(req);
  }
}

function unknown(req: FlowExchangeRequest): FlowExchangeResponse {
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "warning", text: `Unknown action ${req.action_id}` }],
  };
}

async function listQueue(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barId = String(req.context?.bar_id ?? req.fields?.bar_id ?? "");
  const status = String(req.fields?.queue ?? req.filters?.queue ?? "pending");
  if (!barId) return missingBar(req);
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_code, total_minor, currency, table_label, created_at")
    .eq("bar_id", barId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return failure(req, "Failed to load orders");
  return {
    next_screen_id: "s_orders_list",
    data: {
      bar_id: barId,
      queue: status,
      orders: (data ?? []).map((order) => ({
        id: order.id,
        title: `#${order.order_code} — ${order.table_label ?? ""}`,
        description: fmtCurrency(order.total_minor ?? 0, order.currency ?? "RWF"),
      })),
    },
  };
}

async function openOrder(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const orderId = String(req.fields?.order_id ?? "");
  if (!orderId) return failure(req, "Missing order");
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_code, status, table_label, total_minor, currency, note, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) return failure(req, "Order not found");
  const { data: items } = await supabase
    .from("order_items")
    .select("item_name, qty, line_total_minor")
    .eq("order_id", orderId);
  return {
    next_screen_id: "s_order_detail",
    data: {
      order_id: orderId,
      summary_text: `${items?.map((i) => `${i.qty}x ${i.item_name}`).join("\n") ?? ""}\nTotal ${fmtCurrency(data.total_minor ?? 0, data.currency ?? "RWF")}`,
      timeline_text: `${data.status} — ${new Date(data.created_at).toLocaleString()}`,
    },
  };
}

async function markStatus(req: FlowExchangeRequest, status: "paid" | "served" | "cancelled"): Promise<FlowExchangeResponse> {
  const orderId = String(req.fields?.order_id ?? "");
  const barId = String(req.context?.bar_id ?? req.fields?.bar_id ?? "");
  const reason = typeof req.fields?.reason === "string" ? req.fields.reason : undefined;
  if (!orderId || !barId) return missingBar(req);
  const updates: Record<string, unknown> = { status };
  const now = new Date().toISOString();
  if (status === "paid") updates.paid_at = now;
  if (status === "served") updates.served_at = now;
  if (status === "cancelled") updates.cancelled_at = now;
  const { error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", orderId)
    .eq("bar_id", barId);
  if (error) return failure(req, "Update failed");
  await supabase.from("order_events").insert({
    order_id: orderId,
    event_type: status,
    actor_type: "vendor",
    note: reason ?? null,
  });
  await notifyCustomerStatus({ orderId, status, reason });
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "info", text: `Order marked ${status}.` }],
  };
}

function missingBar(req: FlowExchangeRequest): FlowExchangeResponse {
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "error", text: "Missing bar context" }],
  };
}

function failure(req: FlowExchangeRequest, message: string): FlowExchangeResponse {
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "error", text: message }],
  };
}
