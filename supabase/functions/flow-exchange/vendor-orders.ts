import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { buildErrorResponse, buildInfoResponse } from "./utils.ts";
import type { SupabaseClient } from "./types.ts";
import { sendTemplateNotification } from "../_shared/notifications.ts";

const queueSchema = z.object({
  bar_id: z.string().uuid(),
  queue: z.enum(["pending", "paid", "served", "cancelled"]).optional().default(
    "pending",
  ),
});

const orderActionSchema = z.object({
  bar_id: z.string().uuid(),
  order_id: z.string().uuid(),
  reason: z.string().min(4).max(120).optional(),
});

const TEMPLATE_ORDER_PAID_CUSTOMER =
  Deno.env.get("TEMPLATE_ORDER_PAID_CUSTOMER") ?? "order_paid_customer";
const TEMPLATE_ORDER_SERVED_CUSTOMER =
  Deno.env.get("TEMPLATE_ORDER_SERVED_CUSTOMER") ?? "order_served_customer";
const TEMPLATE_ORDER_CANCELLED_CUSTOMER =
  Deno.env.get("TEMPLATE_ORDER_CANCELLED_CUSTOMER") ??
    "order_cancelled_customer";

function resolveField(payload: Record<string, unknown>, key: string) {
  if (key in payload && payload[key] !== undefined) return payload[key];
  const fields = (payload.fields as Record<string, unknown> | null) ??
    undefined;
  const context = (payload.context as Record<string, unknown> | null) ??
    undefined;
  if (fields && key in fields) return fields[key];
  if (context && key in context) return context[key];
  return undefined;
}

export async function handleVendorQueue(
  payload: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const parsed = queueSchema.parse({
    bar_id: resolveField(payload, "bar_id"),
    queue: resolveField(payload, "queue") ?? "pending",
  });

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_code, table_label, total_minor, status, created_at")
    .eq("bar_id", parsed.bar_id)
    .eq("status", parsed.queue)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;

  const items = (data ?? []).map((order) => ({
    id: order.id,
    title: `#${order.order_code} — Table ${order.table_label}`,
    description: `${new Date(order.created_at).toLocaleTimeString()} · ${
      formatCurrency(order.total_minor ?? 0)
    }`,
  }));

  return buildInfoResponse("s_orders_list", {
    bar_id: parsed.bar_id,
    queue: parsed.queue,
    orders: items,
  });
}

export async function handleVendorOrderDetail(
  payload: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const parsed = orderActionSchema.parse({
    bar_id: resolveField(payload, "bar_id"),
    order_id: resolveField(payload, "order_id"),
  });

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_code, table_label, total_minor, subtotal_minor, service_charge_minor, status, created_at, note",
    )
    .eq("id", parsed.order_id)
    .maybeSingle();
  if (error) throw error;
  if (!order) {
    return buildErrorResponse("s_orders_list", "Order not found.");
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("item_name, qty, line_total_minor")
    .eq("order_id", parsed.order_id)
    .order("item_name", { ascending: true });

  const lines = (items ?? []).map((item) =>
    `${item.qty}x ${item.item_name} — ${
      formatCurrency(item.line_total_minor ?? 0)
    }`
  ).join("\n");

  return buildInfoResponse("s_order_detail", {
    order_id: order.id,
    order_code: order.order_code,
    table_label: order.table_label,
    status: order.status,
    summary_text: lines,
    total_formatted: formatCurrency(order.total_minor ?? 0),
    created_at: new Date(order.created_at).toLocaleString(),
    note: order.note ?? null,
  });
}

export async function handleVendorMarkPaid(
  payload: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const parsed = orderActionSchema.parse({
    bar_id: resolveField(payload, "bar_id"),
    order_id: resolveField(payload, "order_id"),
  });

  const { error } = await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", parsed.order_id)
    .eq("bar_id", parsed.bar_id);
  if (error) throw error;

  await supabase.from("order_events").insert({
    order_id: parsed.order_id,
    event_type: "paid",
    actor_type: "vendor",
  });

  const orderInfo = await fetchOrderNotificationInfo(supabase, parsed.order_id);
  if (orderInfo?.customerWaId) {
    await sendTemplateNotification({
      supabase,
      to: orderInfo.customerWaId,
      template: TEMPLATE_ORDER_PAID_CUSTOMER,
      type: "order_paid_customer",
      orderId: parsed.order_id,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: orderInfo.orderCode },
            { type: "text", text: orderInfo.barName ?? "" },
          ],
        },
      ],
    });
  }

  return handleVendorOrderDetail(payload, supabase);
}

export async function handleVendorMarkServed(
  payload: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const parsed = orderActionSchema.parse({
    bar_id: resolveField(payload, "bar_id"),
    order_id: resolveField(payload, "order_id"),
  });

  const { error } = await supabase
    .from("orders")
    .update({ status: "served", served_at: new Date().toISOString() })
    .eq("id", parsed.order_id)
    .eq("bar_id", parsed.bar_id);
  if (error) throw error;

  await supabase.from("order_events").insert({
    order_id: parsed.order_id,
    event_type: "served",
    actor_type: "vendor",
  });

  const orderInfo = await fetchOrderNotificationInfo(supabase, parsed.order_id);
  if (orderInfo?.customerWaId) {
    await sendTemplateNotification({
      supabase,
      to: orderInfo.customerWaId,
      template: TEMPLATE_ORDER_SERVED_CUSTOMER,
      type: "order_served_customer",
      orderId: parsed.order_id,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: orderInfo.orderCode },
            { type: "text", text: orderInfo.tableLabel ?? "" },
          ],
        },
      ],
    });
  }

  return handleVendorOrderDetail(payload, supabase);
}

export async function handleVendorCancel(
  payload: Record<string, unknown>,
  supabase: SupabaseClient,
) {
  const parsed = orderActionSchema.parse({
    bar_id: resolveField(payload, "bar_id"),
    order_id: resolveField(payload, "order_id"),
    reason: resolveField(payload, "reason"),
  });

  if (!parsed.reason) {
    return buildErrorResponse("s_cancel_reason", "Provide a reason.");
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", parsed.order_id)
    .eq("bar_id", parsed.bar_id);
  if (error) throw error;

  await supabase.from("order_events").insert({
    order_id: parsed.order_id,
    event_type: "cancelled",
    actor_type: "vendor",
    note: parsed.reason,
  });

  const orderInfo = await fetchOrderNotificationInfo(supabase, parsed.order_id);
  if (orderInfo?.customerWaId) {
    await sendTemplateNotification({
      supabase,
      to: orderInfo.customerWaId,
      template: TEMPLATE_ORDER_CANCELLED_CUSTOMER,
      type: "order_cancelled_customer",
      orderId: parsed.order_id,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: orderInfo.orderCode },
            { type: "text", text: parsed.reason ?? "" },
          ],
        },
      ],
    });
  }

  return handleVendorOrderDetail(payload, supabase);
}

function formatCurrency(amountMinor: number) {
  return `RWF ${(amountMinor / 100).toFixed(2)}`;
}

async function fetchOrderNotificationInfo(
  supabase: SupabaseClient,
  orderId: string,
) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_code, table_label, bar_id, profile_id, bars ( name )",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load order for notification", error);
    return null;
  }
  if (!data) return null;
  let customerWaId: string | null = null;
  const profileId = (data as { profile_id?: string | null }).profile_id ?? null;
  if (profileId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("whatsapp_e164")
      .eq("user_id", profileId)
      .maybeSingle();
    if (profileError && profileError.code !== "PGRST116") {
      console.error("Failed to load profile for order", profileError);
    }
    customerWaId = profile?.whatsapp_e164 ?? null;
  }
  return {
    orderCode: data.order_code,
    tableLabel: data.table_label,
    barName: data.bars?.name ?? null,
    customerWaId,
  };
}
