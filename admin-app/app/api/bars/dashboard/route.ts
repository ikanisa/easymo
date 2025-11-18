export const dynamic = "force-dynamic";

import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonError, jsonOk, zodValidationError } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { logStructured } from "@/lib/server/logger";

const querySchema = z.object({
  barId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(50).optional(),
});

type OrderRow = {
  id: string;
  order_code: string | null;
  status: string | null;
  table_label: string | null;
  created_at: string;
  updated_at: string | null;
  total_minor: number | null;
  metadata: Record<string, unknown> | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  item_name: string;
  qty: number;
  status: string | null;
};

type MessageRow = {
  id: string;
  direction: "user" | "assistant";
  content: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function parseTable(label: string | null | undefined) {
  return label?.trim() || "Unassigned";
}

export const GET = createHandler("admin_api.bars.dashboard", async (request, _context, { recordMetric }) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    recordMetric("bars.dashboard.supabase_unavailable", 1);
    return jsonError({ error: "supabase_unavailable", message: "Supabase credentials missing." }, 503);
  }

  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    recordMetric("bars.dashboard.invalid_query", 1);
    return zodValidationError(error);
  }

  const limit = query.limit ?? 20;

  // Try canonical bars schema first; on failure, fall back to restaurant-based schema
  let orders: OrderRow[] = [];
  {
    const ordersQuery = adminClient
      .from("orders")
      .select("id, order_code, status, table_label, created_at, updated_at, total_minor, metadata")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (query.barId) ordersQuery.eq("bar_id", query.barId);
    const { data, error } = await ordersQuery;
    if (!error) {
      orders = (data ?? []) as OrderRow[];
    } else {
      // Fallback: restaurant schema (orders with order_number, table_id, total, metadata)
      const alt = await adminClient
        .from('orders')
        .select('id, order_number, status, table_id, created_at, updated_at, total, metadata, restaurants:restaurants(name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (alt.error) {
        recordMetric("bars.dashboard.orders_error", 1, { message: alt.error.message });
        logStructured({ event: 'bars_dashboard_orders_failed', target: 'orders', status: 'error', message: alt.error.message });
        return jsonError({ error: 'orders_fetch_failed', message: 'Unable to load bar orders.' }, 500);
      }
      const barName = query.barId
        ? (await adminClient.from('bars').select('name').eq('id', query.barId).maybeSingle()).data?.name ?? ''
        : '';
      const rows = (alt.data ?? []) as any[];
      const filtered = barName
        ? rows.filter((r) => {
            const rn = Array.isArray(r.restaurants) ? r.restaurants[0]?.name : r.restaurants?.name;
            return typeof rn === 'string' && rn.toLowerCase().includes(barName.toLowerCase());
          })
        : rows;
      orders = filtered.map((r) => ({
        id: r.id,
        order_code: r.order_number ?? null,
        status: r.status ?? null,
        table_label: (r.table_id ?? null) as any, // shows raw id when no label available
        created_at: r.created_at,
        updated_at: r.updated_at ?? null,
        total_minor: r.total ? Math.round(Number(r.total) * 100) : null,
        metadata: (r.metadata ?? null) as any,
      }));
    }
  }
  const orderIds = orders.map((order) => order.id);

  let orderItems: OrderItemRow[] = [];
  if (orderIds.length) {
    const { data: itemsData, error: itemsError } = await adminClient
      .from("order_items")
      .select("id, order_id, item_name, qty, status")
      .in("order_id", orderIds);

    if (itemsError) {
      recordMetric("bars.dashboard.order_items_error", 1, { message: itemsError.message });
      logStructured({
        event: "bars_dashboard_order_items_failed",
        target: "order_items",
        status: "error",
        message: itemsError.message,
      });
    } else {
      orderItems = (itemsData ?? []) as OrderItemRow[];
    }
  }

  let messages: MessageRow[] = [];
  if (query.barId) {
    const { data: messagesData, error: messagesError } = await adminClient
      .from("wa_messages")
      .select("id, direction, content, created_at, metadata")
      .contains("metadata", { bar_id: query.barId })
      .order("created_at", { ascending: false })
      .limit(50);

    if (messagesError) {
      recordMetric("bars.dashboard.messages_error", 1, { message: messagesError.message });
      logStructured({
        event: "bars_dashboard_messages_failed",
        target: "wa_messages",
        status: "error",
        message: messagesError.message,
      });
    } else {
      messages = (messagesData ?? []) as MessageRow[];
    }
  }

  const floor = orders.reduce<Record<string, { table: string; openOrders: number; lastOrderAt: string }>>((acc, order) => {
    const key = parseTable(order.table_label);
    const current = acc[key] ?? { table: key, openOrders: 0, lastOrderAt: order.created_at };
    const isOpen = !order.status || ["pending", "preparing", "confirmed"].includes(order.status);
    return {
      ...acc,
      [key]: {
        table: key,
        openOrders: current.openOrders + (isOpen ? 1 : 0),
        lastOrderAt: current.lastOrderAt > order.created_at ? current.lastOrderAt : order.created_at,
      },
    };
  }, {});

  const kitchenTickets = orders.map((order) => ({
    id: order.id,
    orderCode: order.order_code ?? order.id.slice(0, 6).toUpperCase(),
    status: order.status ?? "unknown",
    table: parseTable(order.table_label),
    createdAt: order.created_at,
    items: orderItems
      .filter((item) => item.order_id === order.id)
      .map((item) => ({
        id: item.id,
        name: item.item_name,
        quantity: item.qty,
        status: item.status ?? "pending",
      })),
  }));

  const threadEvents = messages.slice(0, 10).map((message) => ({
    id: message.id,
    direction: message.direction,
    content: message.content ?? "",
    createdAt: message.created_at,
    agent: (message.metadata as any)?.agent_display_name ?? null,
  }));

  recordMetric("bars.dashboard.success", 1, { orders: orders.length });

  return jsonOk({
    floor: Object.values(floor),
    kitchen: kitchenTickets,
    threads: threadEvents,
  });
});

export const runtime = "nodejs";
