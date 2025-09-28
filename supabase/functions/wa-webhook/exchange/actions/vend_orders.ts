import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { fmtCurrency } from "../../utils/text.ts";
import { notifyCustomerStatus } from "../../notify/hooks.ts";
import { extractBarId } from "../helpers.ts";

type OrderStatus = "pending" | "paid" | "served" | "cancelled";
type OrderActionStatus = "paid" | "served" | "cancelled";
type FlowMessage = FlowExchangeResponse["messages"] extends Array<infer M> ? M
  : never;

type OrderRow = {
  id: string;
  bar_id: string;
  order_code: string;
  status: string | null;
  table_label: string | null;
  total_minor: number | null;
  currency: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type OrderItemRow = {
  item_name: string | null;
  qty: number | string | null;
  line_total_minor: number | null;
};

type OrderEventRow = {
  event_type: string | null;
  actor_type: string | null;
  note: string | null;
  created_at: string | null;
};

const QUEUE_TITLES: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  served: "Served",
  cancelled: "Cancelled",
};

const LIST_LIMIT = 20;

export async function handleVendorOrders(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_view_queue":
    case "a_refresh":
      return await listQueue(req);
    case "a_open_order_detail":
    case "a_refresh_order_detail":
      return await openOrderDetail(req);
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

async function listQueue(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = extractBarId(req);
  if (!barId) return missingBar(req);

  const queue = normalizeStatus(
    req.fields?.queue ?? req.filters?.queue ?? req.context?.queue,
  );

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_code, status, table_label, total_minor, currency, created_at, updated_at",
    )
    .eq("bar_id", barId)
    .eq("status", queue)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) return failure(req, "Failed to load orders");

  const orders = (data ?? []).map((order) => {
    const orderStatus = normalizeStatus(order.status, queue);
    const when = formatTime(order.created_at);
    const descriptionParts = [
      fmtCurrency(order.total_minor ?? 0, order.currency ?? "RWF"),
    ];
    if (order.table_label?.trim()) {
      descriptionParts.push(order.table_label.trim());
    }
    if (when) descriptionParts.push(when);

    return {
      id: order.id,
      title: `#${order.order_code} — ${QUEUE_TITLES[orderStatus]}`,
      description: descriptionParts.join(" • "),
      data: {
        order_updated_at: order.updated_at ?? "",
        status: orderStatus,
        order_code: order.order_code,
      },
    };
  });

  return {
    next_screen_id: "s_orders_list",
    data: {
      bar_id: barId,
      queue,
      queue_title: QUEUE_TITLES[queue],
      orders,
    },
  };
}

async function openOrderDetail(
  req: FlowExchangeRequest,
  options?: {
    queue?: OrderStatus;
    barId?: string;
    message?: FlowMessage;
  },
): Promise<FlowExchangeResponse> {
  const orderId = asString(req.fields?.order_id ?? req.filters?.order_id);
  if (!orderId) return failure(req, "Missing order");

  const barId = options?.barId ?? extractBarId(req);

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, bar_id, order_code, status, table_label, total_minor, currency, note, created_at, updated_at",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) return failure(req, "Order not found");
  if (barId && order.bar_id !== barId) return failure(req, "Order mismatch");

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("item_name, qty, line_total_minor")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (itemsError) return failure(req, "Failed to load items");

  const { data: events, error: eventsError } = await supabase
    .from("order_events")
    .select("event_type, actor_type, note, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (eventsError) return failure(req, "Failed to load timeline");

  const orderStatus = normalizeStatus(order.status);
  const queue = options?.queue ?? normalizeStatus(
    req.fields?.queue ?? req.filters?.queue ?? req.context?.queue,
    orderStatus,
  );

  const headerText = `#${order.order_code} — ${QUEUE_TITLES[orderStatus]}`;
  const metaParts: string[] = [];
  if (order.table_label?.trim()) metaParts.push(order.table_label.trim());
  metaParts.push(fmtCurrency(order.total_minor ?? 0, order.currency ?? "RWF"));
  const created = formatDateTime(order.created_at);
  if (created) metaParts.push(created);
  const metaText = metaParts.join(" • ");

  const summaryText = buildSummaryText(order, items ?? []);
  const timelineText = buildTimelineText(order, events ?? []);

  const response: FlowExchangeResponse = {
    next_screen_id: "s_order_detail",
    data: {
      queue,
      order_id: order.id,
      order_code: order.order_code,
      order_updated_at: order.updated_at ?? "",
      order_status: orderStatus,
      order_header_text: headerText,
      order_meta_text: metaText,
      summary_text: summaryText,
      timeline_text: timelineText,
    },
  };

  if (options?.message) response.messages = [options.message];

  return response;
}

async function markStatus(
  req: FlowExchangeRequest,
  status: OrderActionStatus,
): Promise<FlowExchangeResponse> {
  const orderId = asString(req.fields?.order_id);
  const barId = extractBarId(req);
  if (!orderId) return failure(req, "Missing order");
  if (!barId) return missingBar(req);

  const queue = normalizeStatus(
    req.fields?.queue ?? req.filters?.queue ?? req.context?.queue,
  );
  const token = asString(req.fields?.order_updated_at);
  const reason = asOptionalString(req.fields?.reason);

  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status,
    updated_at: nowIso,
  };
  if (status === "paid") updates.paid_at = nowIso;
  if (status === "served") updates.served_at = nowIso;
  if (status === "cancelled") updates.cancelled_at = nowIso;

  const updateQuery = supabase
    .from("orders")
    .update(updates)
    .eq("id", orderId)
    .eq("bar_id", barId);
  if (token) updateQuery.eq("updated_at", token);

  const { data: updatedRows, error } = await updateQuery.select("id");
  if (error) return failure(req, "Update failed");
  if (!updatedRows?.length) {
    return await openOrderDetail(req, {
      queue,
      barId,
      message: {
        level: "warning",
        text: "Order was updated elsewhere. Refresh to see the latest details.",
      },
    });
  }

  const { error: eventError } = await supabase.from("order_events").insert({
    order_id: orderId,
    event_type: status,
    actor_type: "vendor",
    note: reason ?? null,
  });
  if (eventError) {
    console.error("vend_orders.order_events_insert_failed", {
      orderId,
      status,
      error: eventError,
    });
  }

  try {
    await notifyCustomerStatus({ orderId, status, reason });
  } catch (notifyError) {
    console.error("vend_orders.notify_failed", {
      orderId,
      status,
      notifyError,
    });
  }

  return await openOrderDetail(req, {
    queue,
    barId,
    message: {
      level: "info",
      text: `Order marked ${QUEUE_TITLES[status]}.`,
    },
  });
}

function buildSummaryText(order: OrderRow, items: OrderItemRow[]): string {
  const lines = items.map((item) => {
    const qty = Number(item.qty ?? 0);
    const qtyText = Number.isFinite(qty) && qty > 0 ? `${qty}x ` : "";
    const name = item.item_name?.trim() ?? "Item";
    const total = fmtCurrency(
      item.line_total_minor ?? 0,
      order.currency ?? "RWF",
    );
    return `${qtyText}${name} • ${total}`;
  });
  if (!lines.length) lines.push("No line items recorded.");
  lines.push(
    `Total ${fmtCurrency(order.total_minor ?? 0, order.currency ?? "RWF")}`,
  );
  if (order.note?.trim()) lines.push(`Note: ${order.note.trim()}`);
  return lines.join("\n");
}

function buildTimelineText(order: OrderRow, events: OrderEventRow[]): string {
  const lines: string[] = [];
  const created = formatDateTime(order.created_at);
  if (created) lines.push(`Created • ${created}`);

  for (const event of events) {
    const label = formatTimelineLabel(event.event_type);
    const when = formatDateTime(event.created_at);
    const note = asOptionalString(event.note);
    const parts = [label];
    if (when) parts.push(`• ${when}`);
    if (note) parts.push(`— ${note}`);
    lines.push(parts.join(" "));
  }

  if (!lines.length) return "No updates yet.";
  return lines.join("\n");
}

function formatTimelineLabel(eventType: unknown): string {
  if (typeof eventType !== "string" || !eventType.length) return "Updated";
  return eventType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(
  value: unknown,
  fallback: OrderStatus = "pending",
): OrderStatus {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (
      normalized === "pending" || normalized === "paid" ||
      normalized === "served" || normalized === "cancelled"
    ) {
      return normalized as OrderStatus;
    }
  }
  return fallback;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function missingBar(req: FlowExchangeRequest): FlowExchangeResponse {
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "error", text: "Missing bar context" }],
  };
}

function failure(
  req: FlowExchangeRequest,
  message: string,
): FlowExchangeResponse {
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "error", text: message }],
  };
}
