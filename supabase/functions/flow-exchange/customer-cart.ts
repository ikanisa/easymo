import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { buildErrorResponse, buildInfoResponse } from "./utils.ts";
import type { SupabaseClient } from "./types.ts";
import type { CustomerRequestPayload } from "./customer.ts";
import { sendTemplateNotification } from "../_shared/notifications.ts";

const addToCartSchema = z.object({
  wa_id: z.string().min(5),
  bar_id: z.string().uuid(),
  item_id: z.string().uuid(),
  qty: z.coerce.number().int().min(1).max(50),
});

const viewCartSchema = z.object({
  wa_id: z.string().min(5),
  bar_id: z.string().uuid(),
});

const updateLineSchema = z.object({
  wa_id: z.string().min(5),
  bar_id: z.string().uuid(),
  line_id: z.string().uuid(),
  new_qty: z.coerce.number().int().min(0).max(50),
});

const placeOrderSchema = z.object({
  wa_id: z.string().min(5),
  bar_id: z.string().uuid(),
  table_label: z.string().min(1).max(8),
  note: z.string().max(140).optional(),
});

const orderDetailSchema = z.object({
  wa_id: z.string().min(5),
  order_id: z.string().uuid(),
});

const TEMPLATE_ORDER_CREATED_VENDOR =
  Deno.env.get("TEMPLATE_ORDER_CREATED_VENDOR") ?? "order_created_vendor";
const TEMPLATE_ORDER_PAID_CUSTOMER =
  Deno.env.get("TEMPLATE_ORDER_PAID_CUSTOMER") ?? "order_paid_customer";
const TEMPLATE_ORDER_SERVED_CUSTOMER =
  Deno.env.get("TEMPLATE_ORDER_SERVED_CUSTOMER") ?? "order_served_customer";
const TEMPLATE_ORDER_CANCELLED_CUSTOMER =
  Deno.env.get("TEMPLATE_ORDER_CANCELLED_CUSTOMER") ??
    "order_cancelled_customer";

type ActionPayload = CustomerRequestPayload & {
  wa_id?: string;
  fields?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
};

export async function handleAddToCart(
  payload: ActionPayload,
  supabase: SupabaseClient,
) {
  const parsed = addToCartSchema.parse({
    wa_id: resolveField(payload, "wa_id"),
    bar_id: resolveField(payload, "bar_id"),
    item_id: resolveField(payload, "item_id"),
    qty: resolveField(payload, "qty"),
  });

  const profileId = await getOrCreateProfileId(supabase, parsed.wa_id);
  const item = await fetchItem(supabase, parsed.item_id);
  if (!item || !item.is_available) {
    return buildErrorResponse("s_items", "This item is currently unavailable.");
  }

  const cart = await getOrCreateCart(supabase, profileId, parsed.bar_id);
  await upsertCartItem(supabase, cart.id, item, parsed.qty);
  const totals = await recalcCartTotals(supabase, cart.id, parsed.bar_id);

  return buildInfoResponse("s_items", {
    cart_summary_text: totals.summary,
    subtotal: totals.subtotalFormatted,
    service_charge: totals.serviceFormatted,
    total: totals.totalFormatted,
    has_items: totals.lineCount > 0,
  });
}

export async function handleViewCart(
  payload: ActionPayload,
  supabase: SupabaseClient,
) {
  const parsed = viewCartSchema.parse({
    wa_id: resolveField(payload, "wa_id"),
    bar_id: resolveField(payload, "bar_id"),
  });
  const profileId = await getOrCreateProfileId(supabase, parsed.wa_id);
  const cart = await findCart(supabase, profileId, parsed.bar_id);
  if (!cart) {
    return buildInfoResponse("s_cart_view", {
      cart_summary_text: "Your cart is empty.",
      subtotal: formatCurrency(0, null),
      service_charge: formatCurrency(0, null),
      total: formatCurrency(0, null),
      is_empty: true,
    });
  }
  const totals = await recalcCartTotals(supabase, cart.id, parsed.bar_id);
  return buildInfoResponse("s_cart_view", {
    cart_summary_text: totals.summary,
    subtotal: totals.subtotalFormatted,
    service_charge: totals.serviceFormatted,
    total: totals.totalFormatted,
    is_empty: totals.lineCount === 0,
  });
}

export async function handleUpdateCartLine(
  payload: ActionPayload,
  supabase: SupabaseClient,
) {
  const parsed = updateLineSchema.parse({
    wa_id: resolveField(payload, "wa_id"),
    bar_id: resolveField(payload, "bar_id"),
    line_id: resolveField(payload, "line_id"),
    new_qty: resolveField(payload, "new_qty"),
  });

  const profileId = await getOrCreateProfileId(supabase, parsed.wa_id);
  const cart = await findCart(supabase, profileId, parsed.bar_id);
  if (!cart) {
    return buildErrorResponse("s_cart_view", "Cart not found.");
  }

  if (parsed.new_qty === 0) {
    await supabase.from("cart_items").delete().eq("id", parsed.line_id).eq(
      "cart_id",
      cart.id,
    );
  } else {
    const unitPrice = await fetchLineUnitPrice(
      supabase,
      parsed.line_id,
      cart.id,
    );
    await supabase
      .from("cart_items")
      .update({
        qty: parsed.new_qty,
        line_total_minor: parsed.new_qty * unitPrice,
      })
      .eq("id", parsed.line_id)
      .eq("cart_id", cart.id);
  }

  const totals = await recalcCartTotals(supabase, cart.id, parsed.bar_id);

  return buildInfoResponse("s_cart_view", {
    cart_summary_text: totals.summary,
    subtotal: totals.subtotalFormatted,
    service_charge: totals.serviceFormatted,
    total: totals.totalFormatted,
    is_empty: totals.lineCount === 0,
  });
}

export async function handlePlaceOrder(
  payload: ActionPayload,
  supabase: SupabaseClient,
) {
  const parsed = placeOrderSchema.parse({
    wa_id: resolveField(payload, "wa_id"),
    bar_id: resolveField(payload, "bar_id"),
    table_label: resolveField(payload, "table_label"),
    note: resolveField(payload, "note") ?? undefined,
  });

  const profileId = await getOrCreateProfileId(supabase, parsed.wa_id);
  const cart = await findCart(supabase, profileId, parsed.bar_id);
  if (!cart) {
    return buildErrorResponse("s_table_number", "Cart is empty.");
  }

  const totals = await recalcCartTotals(supabase, cart.id, parsed.bar_id);
  if (totals.lineCount === 0) {
    return buildErrorResponse("s_table_number", "Cart is empty.");
  }

  const order = await createOrderFromCart(supabase, {
    cart_id: cart.id,
    profile_id: profileId,
    bar_id: parsed.bar_id,
    table_label: parsed.table_label,
    note: parsed.note ?? null,
    subtotal_minor: totals.subtotal,
    service_charge_minor: totals.serviceCharge,
    total_minor: totals.total,
  });

  const vendorNumbers = await supabase
    .from("bar_numbers")
    .select("number_e164")
    .eq("bar_id", parsed.bar_id)
    .eq("is_active", true);

  if (!vendorNumbers.error) {
    const totalFormatted = totals.totalFormatted;
    await Promise.all(
      (vendorNumbers.data ?? []).map((num) =>
        sendTemplateNotification({
          supabase,
          to: num.number_e164,
          template: TEMPLATE_ORDER_CREATED_VENDOR,
          type: "order_created_vendor",
          orderId: order.id,
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: order.order_code },
                { type: "text", text: parsed.table_label },
                { type: "text", text: totalFormatted },
              ],
            },
          ],
        })
      ),
    );
  }

  return buildInfoResponse("s_payment", {
    order_id: order.id,
    order_code: order.order_code,
    total_formatted: formatCurrency(totals.total, order.currency),
    ussd_code_text: order.momo_code ?? "",
    ussd_uri: createUssdUri(order.momo_code ?? ""),
    payment_instructions: totals.paymentInstructions,
  });
}

export async function handleCustomerPaidSignal(
  payload: ActionPayload,
  supabase: SupabaseClient,
) {
  const parsed = orderDetailSchema.parse({
    wa_id: resolveField(payload, "wa_id"),
    order_id: resolveField(payload, "order_id"),
  });

  await supabase.from("order_events").insert({
    order_id: parsed.order_id,
    event_type: "customer_paid_signal",
    actor_type: "customer",
    actor_identifier: parsed.wa_id,
  });

  const timeline = await fetchOrderTimeline(supabase, parsed.order_id);
  return buildInfoResponse("s_order_status", timeline);
}

export async function handleOrderStatus(
  payload: ActionPayload,
  supabase: SupabaseClient,
) {
  const parsed = orderDetailSchema.parse({
    wa_id: resolveField(payload, "wa_id"),
    order_id: resolveField(payload, "order_id"),
  });
  const timeline = await fetchOrderTimeline(supabase, parsed.order_id);
  return buildInfoResponse("s_order_detail", timeline);
}

function resolveField(payload: ActionPayload, key: string) {
  if (payload[key as keyof ActionPayload]) {
    return payload[key as keyof ActionPayload];
  }
  const fields = payload.fields ?? {};
  const context = payload.context ?? {};
  if (typeof fields === "object" && fields && key in fields) {
    return fields[key];
  }
  if (typeof context === "object" && context && key in context) {
    return context[key];
  }
  return undefined;
}

function normalizeWaId(waId: string): string {
  return waId.startsWith("+") ? waId : `+${waId}`;
}

async function getOrCreateProfileId(
  supabase: SupabaseClient,
  waId: string,
): Promise<string> {
  const normalized = normalizeWaId(waId);
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("whatsapp_e164", normalized)
    .maybeSingle();
  if (error) throw error;
  if (data?.user_id) return data.user_id;
  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({ whatsapp_e164: normalized })
    .select("user_id")
    .single();
  if (insertError) throw insertError;
  return inserted.user_id;
}

async function fetchItem(supabase: SupabaseClient, itemId: string) {
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, bar_id, menu_id, name, short_description, price_minor, currency, flags, is_available",
    )
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getOrCreateCart(
  supabase: SupabaseClient,
  profileId: string,
  barId: string,
) {
  const existing = await findCart(supabase, profileId, barId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("carts")
    .insert({
      profile_id: profileId,
      bar_id: barId,
      status: "open",
    })
    .select("id, bar_id")
    .single();
  if (error) throw error;
  return data;
}

async function findCart(
  supabase: SupabaseClient,
  profileId: string,
  barId: string,
) {
  const { data, error } = await supabase
    .from("carts")
    .select("id, bar_id")
    .eq("profile_id", profileId)
    .eq("bar_id", barId)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertCartItem(
  supabase: SupabaseClient,
  cartId: string,
  item: {
    id: string;
    name: string;
    short_description: string | null;
    price_minor: number;
    currency: string | null;
    flags: unknown;
  },
  qty: number,
) {
  const lineTotal = qty * item.price_minor;
  const { data } = await supabase
    .from("cart_items")
    .select("id, qty")
    .eq("cart_id", cartId)
    .eq("item_id", item.id)
    .maybeSingle();

  if (data) {
    await supabase
      .from("cart_items")
      .update({
        qty: data.qty + qty,
        unit_price_minor: item.price_minor,
        line_total_minor: (data.qty + qty) * item.price_minor,
      })
      .eq("id", data.id)
      .eq("cart_id", cartId);
  } else {
    await supabase.from("cart_items").insert({
      cart_id: cartId,
      item_id: item.id,
      item_name: item.name,
      item_snapshot: {
        description: item.short_description,
      },
      qty,
      unit_price_minor: item.price_minor,
      flags_snapshot: Array.isArray(item.flags) ? item.flags : [],
      modifiers_snapshot: [],
      line_total_minor: lineTotal,
    });
  }
}

async function fetchLineUnitPrice(
  supabase: SupabaseClient,
  lineId: string,
  cartId: string,
) {
  const { data, error } = await supabase
    .from("cart_items")
    .select("unit_price_minor")
    .eq("id", lineId)
    .eq("cart_id", cartId)
    .maybeSingle();
  if (error) throw error;
  return data?.unit_price_minor ?? 0;
}

async function recalcCartTotals(
  supabase: SupabaseClient,
  cartId: string,
  barId: string,
) {
  const { data: items, error } = await supabase
    .from("cart_items")
    .select("id, item_name, qty, unit_price_minor, line_total_minor")
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const subtotal = (items ?? []).reduce(
    (sum, item) => sum + (item.line_total_minor ?? 0),
    0,
  );

  const { data: settings } = await supabase
    .from("bar_settings")
    .select("service_charge_pct, payment_instructions, bar_id")
    .eq("bar_id", barId)
    .maybeSingle();

  const { data: bar } = await supabase
    .from("bars")
    .select("currency")
    .eq("id", barId)
    .maybeSingle();

  const currency = bar?.currency ?? null;
  const serviceChargePct = settings?.service_charge_pct ?? 0;
  const serviceCharge = Math.round(subtotal * Number(serviceChargePct) / 100);
  const total = subtotal + serviceCharge;

  const summary = (items ?? [])
    .map((item) =>
      `${item.qty}x ${item.item_name} — ${
        formatCurrency(item.line_total_minor ?? 0, currency)
      }`
    )
    .join("\n");

  return {
    summary: summary || "Your cart is empty.",
    subtotal,
    serviceCharge,
    total,
    subtotalFormatted: formatCurrency(subtotal, currency),
    serviceFormatted: formatCurrency(serviceCharge, currency),
    totalFormatted: formatCurrency(total, currency),
    lineCount: items?.length ?? 0,
    paymentInstructions: settings?.payment_instructions ?? null,
    currency,
  };
}

async function createOrderFromCart(
  supabase: SupabaseClient,
  params: {
    cart_id: string;
    profile_id: string;
    bar_id: string;
    table_label: string;
    note: string | null;
    subtotal_minor: number;
    service_charge_minor: number;
    total_minor: number;
  },
) {
  const { data: bar, error: barError } = await supabase
    .from("bars")
    .select("momo_code, currency")
    .eq("id", params.bar_id)
    .maybeSingle();
  if (barError) throw barError;

  const orderCode = await generateOrderCode();

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      order_code: orderCode,
      bar_id: params.bar_id,
      profile_id: params.profile_id,
      source_cart_id: params.cart_id,
      table_label: params.table_label,
      subtotal_minor: params.subtotal_minor,
      service_charge_minor: params.service_charge_minor,
      total_minor: params.total_minor,
      momo_code_used: bar?.momo_code ?? null,
      note: params.note,
      status: "pending",
    })
    .select("id, order_code, momo_code_used")
    .single();
  if (error) throw error;

  await copyCartItemsToOrder(supabase, params.cart_id, order.id);
  await supabase.from("order_events").insert({
    order_id: order.id,
    event_type: "created",
    actor_type: "system",
  });
  await supabase.from("carts").update({ status: "locked" }).eq(
    "id",
    params.cart_id,
  );

  return {
    id: order.id,
    order_code: order.order_code,
    momo_code: order.momo_code_used,
    currency: bar?.currency ?? null,
  };
}

async function copyCartItemsToOrder(
  supabase: SupabaseClient,
  cartId: string,
  orderId: string,
) {
  const { data, error } = await supabase
    .from("cart_items")
    .select(
      "item_id, item_name, item_snapshot, qty, unit_price_minor, flags_snapshot, modifiers_snapshot, line_total_minor",
    )
    .eq("cart_id", cartId);
  if (error) throw error;
  if (!data?.length) return;
  const inserts = data.map((item) => ({
    order_id: orderId,
    item_id: item.item_id,
    item_name: item.item_name,
    item_description:
      (item.item_snapshot as { description?: string })?.description ?? null,
    qty: item.qty,
    unit_price_minor: item.unit_price_minor,
    flags_snapshot: item.flags_snapshot ?? [],
    modifiers_snapshot: item.modifiers_snapshot ?? [],
    line_total_minor: item.line_total_minor,
  }));
  await supabase.from("order_items").insert(inserts);
}

async function fetchOrderTimeline(supabase: SupabaseClient, orderId: string) {
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_code, status, table_label, total_minor, created_at, bars!inner (currency)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) throw new Error("Order not found");

  const { data: events } = await supabase
    .from("order_events")
    .select("event_type, created_at, note")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  const timeline = (events ?? []).map((event) =>
    `${event.event_type} ${new Date(event.created_at).toLocaleString()}`
  );

  return {
    order_id: order.id,
    status: order.status,
    timeline_text: timeline.join("\n"),
    summary_text: `Table ${order.table_label}\nTotal ${
      formatCurrency(order.total_minor ?? 0, order.bars?.currency ?? null)
    }`,
  };
}

async function generateOrderCode() {
  return crypto.randomUUID().slice(0, 8).toUpperCase();
}

function formatCurrency(amountMinor: number, currency: string | null) {
  if (!currency) {
    return `RWF ${(amountMinor / 100).toFixed(2)}`;
  }
  const formatter = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  });
  return formatter.format(amountMinor / 100);
}

function createUssdUri(code: string) {
  if (!code) return "";
  return `tel:${code.replace(/\*/g, "%2A").replace(/#/g, "%23")}`;
}
