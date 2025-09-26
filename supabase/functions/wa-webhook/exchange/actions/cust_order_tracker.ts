import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import {
  type CustomerOrderListRow,
  type CustomerOrderView,
  decodePageToken,
  encodePageToken,
  ensureProfile,
  listCustomerOrders,
  orderTimeline,
} from "../helpers.ts";
import { fmtCurrency } from "../../utils/text.ts";

type FlowMessage = FlowExchangeResponse["messages"] extends Array<infer M> ? M
  : never;
type ViewMode = CustomerOrderView;
type OrderDetailRow = CustomerOrderListRow & { note: string | null };

type OrderStatus = "pending" | "paid" | "served" | "cancelled";

const PAGE_SIZE = 5;
const VIEW_LABELS: Record<ViewMode, string> = {
  open: "Open orders",
  history: "Order history",
};
const STATUS_TITLES: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  served: "Served",
  cancelled: "Cancelled",
};

export async function handleCustomerOrderTracker(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_refresh_orders":
      return await refreshOrders(req);
    case "a_open_order":
      return await openOrder(req);
    case "a_reorder_prompt":
      return await reorderPrompt(req);
    default:
      return unknown(req);
  }
}

async function refreshOrders(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const customer = await ensureProfile(req.wa_id);
  const viewMode = parseViewMode(
    req.fields?.view_mode ?? req.filters?.view_mode ?? req.context?.view_mode,
  );
  const pageToken = asString(req.fields?.page_token ?? req.page_token);
  const offset = decodePageToken(pageToken);

  const { orders, hasMore } = await listCustomerOrders(customer.id, {
    view: viewMode,
    limit: PAGE_SIZE,
    offset,
  });

  const mapped = orders.map(mapOrderOption);
  const response: FlowExchangeResponse = {
    next_screen_id: "s_orders_list",
    data: {
      view_mode: viewMode,
      view_label: VIEW_LABELS[viewMode],
      orders: mapped,
      page_token_current: encodePageToken(offset),
      page_token_next: hasMore ? encodePageToken(offset + PAGE_SIZE) : null,
      page_token_prev: offset > 0
        ? encodePageToken(Math.max(offset - PAGE_SIZE, 0))
        : null,
    },
  };

  if (!mapped.length) {
    response.messages = [{
      level: "info",
      text: viewMode === "history"
        ? "No served or cancelled orders yet."
        : "No active orders found. Your next order will show up here.",
    }];
  }

  return response;
}

async function openOrder(
  req: FlowExchangeRequest,
  options?: { message?: FlowMessage },
): Promise<FlowExchangeResponse> {
  const orderId = asString(req.fields?.order_id);
  if (!orderId) return failure(req, "Missing order");

  const viewMode = parseViewMode(
    req.fields?.view_mode ?? req.filters?.view_mode ?? req.context?.view_mode,
  );

  const customer = await ensureProfile(req.wa_id);
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, profile_id, bar_id, bars(name), order_code, status, table_label, total_minor, currency, note, created_at, updated_at",
    )
    .eq("profile_id", customer.id)
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) return failure(req, "Order not found");

  const order = data as OrderDetailRow;
  const status = normalizeStatus(order.status);
  const timeline = await orderTimeline(orderId);
  const summaryText = buildOrderSummary(order, status);
  const timelineText = timeline?.trim()?.length ? timeline : "No updates yet.";
  const canReorder = status === "served" || status === "cancelled";

  const response: FlowExchangeResponse = {
    next_screen_id: "s_order_detail",
    data: {
      order_id: order.id,
      order_code: order.order_code ?? "",
      order_header_text: `#${order.order_code ?? ""} — ${
        STATUS_TITLES[status]
      }`,
      summary_text: summaryText,
      timeline_text: timelineText,
      view_mode: viewMode,
      can_reorder: canReorder ? "true" : "false",
      reorder_hint: canReorder ? "Tap Order again to reopen the bar menu." : "",
    },
  };

  if (options?.message) response.messages = [options.message];
  return response;
}

async function reorderPrompt(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const detail = await openOrder(req);
  if (detail.next_screen_id !== "s_order_detail") return detail;

  const canReorder =
    (detail.data?.can_reorder as string | undefined) === "true";
  const message: FlowMessage = canReorder
    ? {
      level: "info",
      text: "Reply MENU to start a fresh order with this bar.",
    }
    : {
      level: "warning",
      text:
        "This order is still in progress. Order again once it is completed.",
    };
  detail.messages = detail.messages ? [...detail.messages, message] : [message];
  return detail;
}

function mapOrderOption(order: CustomerOrderListRow) {
  const status = normalizeStatus(order.status);
  const barName = order.bars?.name?.trim();
  const when = formatDateTime(order.created_at);
  const parts: string[] = [];
  if (barName) parts.push(barName);
  parts.push(fmtCurrency(order.total_minor ?? 0, order.currency ?? "RWF"));
  if (order.table_label?.trim()) {
    parts.push(`Table ${order.table_label.trim()}`);
  }
  if (when) parts.push(when);

  return {
    id: order.id,
    title: `#${order.order_code ?? ""} — ${STATUS_TITLES[status]}`,
    description: parts.join(" • "),
    data: {
      status,
      order_code: order.order_code ?? "",
      bar_id: order.bar_id ?? "",
    },
  };
}

function buildOrderSummary(order: OrderDetailRow, status: OrderStatus): string {
  const lines: string[] = [];
  lines.push(`#${order.order_code ?? ""}`);
  const barName = order.bars?.name?.trim();
  if (barName) lines.push(barName);
  lines.push(`Status: ${STATUS_TITLES[status]}`);
  lines.push(
    `Total: ${fmtCurrency(order.total_minor ?? 0, order.currency ?? "RWF")}`,
  );
  if (order.table_label?.trim()) {
    lines.push(`Table: ${order.table_label.trim()}`);
  }
  const placed = formatDateTime(order.created_at);
  if (placed) lines.push(`Placed: ${placed}`);
  if (order.note?.trim()) lines.push(`Note: ${order.note.trim()}`);
  return lines.join("\n");
}

function parseViewMode(value: unknown): ViewMode {
  if (value === "history") return "history";
  return "open";
}

function normalizeStatus(value: unknown): OrderStatus {
  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    if (
      lowered === "pending" || lowered === "paid" ||
      lowered === "served" || lowered === "cancelled"
    ) {
      return lowered as OrderStatus;
    }
  }
  return "pending";
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

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function unknown(req: FlowExchangeRequest): FlowExchangeResponse {
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "warning", text: `Unknown action ${req.action_id}` }],
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
