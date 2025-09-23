import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import {
  decodePageToken,
  encodePageToken,
  ensureCustomer,
  ensureCart,
  ensureSession,
  getBar,
  getCartSummary,
  getPublishedMenu,
  listCategories,
  listItems,
  repriceCart,
  upsertCartItem,
  updateCartLineQty,
  removeCartLine,
  formatTotals,
  extractBarId,
  buildPaymentPayload,
  orderTimeline,
} from "../helpers.ts";
import { fmtCurrency } from "../../utils/text.ts";
import { notifyOrderCreated } from "../../notify/hooks.ts";

const LIMIT = 10;

export async function handleCustomerBarMenu(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_open_menu":
      return await openMenu(req);
    case "a_select_category":
      return await refreshCategories(req);
    case "a_open_items":
      return await listMenuItems(req, 0);
    case "a_paged_items":
      return await listMenuItems(req, decodePageToken(req.page_token));
    case "a_open_item":
      return await openItem(req);
    case "a_add_to_cart":
      return await addToCart(req);
    case "a_view_cart":
      return await viewCart(req);
    case "a_edit_cart":
      return await editCart(req);
    case "a_update_line":
      return await updateCartLine(req);
    case "a_place_order":
      return await placeOrder(req);
    case "a_customer_paid_signal":
      return await customerPaid(req);
    case "a_view_status":
      return await viewStatus(req);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{ level: "warning", text: `Unknown action ${req.action_id}` }],
      };
  }
}

async function openMenu(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barId = extractBarId(req);
  if (!barId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing bar id" }],
    };
  }
  const bar = await getBar(barId);
  if (!bar) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Bar not found" }],
    };
  }
  const publishedMenu = await getPublishedMenu(barId);
  if (!publishedMenu) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "warning", text: "Menu not available yet." }],
    };
  }
  await ensureSession({ waId: req.wa_id, role: "customer", barId, currentFlow: req.flow_id });
  const categories = await listCategories(barId, publishedMenu.id);
  return {
    next_screen_id: "s_categories",
    data: {
      bar_id: barId,
      bar_name: bar.name,
      categories: categories.map((cat) => ({ id: cat.id, title: cat.name })),
      has_subcategories: false,
      subcategories: [],
    },
  };
}

async function refreshCategories(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barId = extractBarId(req);
  if (!barId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing bar id" }],
    };
  }
  const publishedMenu = await getPublishedMenu(barId);
  if (!publishedMenu) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "warning", text: "Menu not available" }],
    };
  }
  const categories = await listCategories(barId, publishedMenu.id);
  return {
    next_screen_id: "s_categories",
    data: {
      bar_id: barId,
      categories: categories.map((cat) => ({ id: cat.id, title: cat.name })),
      has_subcategories: false,
      subcategories: [],
    },
  };
}

async function listMenuItems(req: FlowExchangeRequest, offset: number): Promise<FlowExchangeResponse> {
  const barId = extractBarId(req);
  const categoryId = typeof req.fields?.category_id === "string" ? req.fields.category_id : undefined;
  if (!barId || !categoryId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing bar or category" }],
    };
  }
  const bar = await getBar(barId);
  if (!bar) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Bar not found" }],
    };
  }
  const publishedMenu = await getPublishedMenu(barId);
  if (!publishedMenu) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "warning", text: "Menu not available" }],
    };
  }
  const items = await listItems({ barId, menuId: publishedMenu.id, categoryId, offset, limit: LIMIT });
  const rows = items.map((item) => ({
    id: item.id,
    title: `${item.name} — ${fmtCurrency(item.price_minor ?? 0, item.currency ?? bar.currency ?? "RWF")}`,
    description: item.short_description ?? "",
  }));
  const nextOffset = items.length === LIMIT ? offset + LIMIT : null;
  const prevOffset = offset > 0 ? Math.max(offset - LIMIT, 0) : null;
  return {
    next_screen_id: "s_items",
    data: {
      bar_id: barId,
      category_id: categoryId,
      items: rows,
      page_token_next: nextOffset !== null ? encodePageToken(nextOffset) : null,
      page_token_prev: prevOffset !== null ? encodePageToken(prevOffset) : null,
    },
  };
}

async function openItem(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const itemId = typeof req.fields?.item_id === "string" ? req.fields.item_id : undefined;
  if (!itemId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing item id" }],
    };
  }
  const { data, error } = await supabase
    .from("items")
    .select("id, bar_id, menu_id, name, short_description, price_minor, currency, flags, metadata")
    .eq("id", itemId)
    .maybeSingle();
  if (error || !data) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Item not found" }],
    };
  }
  return {
    next_screen_id: "s_item_detail",
    data: {
      bar_id: data.bar_id,
      item_id: data.id,
      item_name: data.name,
      item_desc: data.short_description ?? "",
      price: fmtCurrency(data.price_minor ?? 0, data.currency ?? "RWF"),
      modifiers: (data.metadata?.modifiers ?? []),
    },
  };
}

async function addToCart(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barId = extractBarId(req);
  const itemId = typeof req.fields?.item_id === "string" ? req.fields.item_id : undefined;
  const waId = req.wa_id;
  const qty = parseInt(String(req.fields?.qty ?? "1"), 10) || 1;
  if (!barId || !itemId || !waId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing bar/item" }],
    };
  }
  const item = await getItem(itemId);
  if (!item) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Item unavailable" }],
    };
  }
  const customer = await ensureCustomer(waId);
  await ensureSession({ waId, role: "customer", barId, customerId: customer.id, currentFlow: req.flow_id });
  const cart = await ensureCart(customer.id, barId);
  await upsertCartItem({ cartId: cart.id, item, qty, modifiers: [] });
  await repriceCart(cart.id, barId);
  const publishedMenu = await getPublishedMenu(barId);
  if (!publishedMenu) {
    return {
      next_screen_id: "s_items",
      messages: [{ level: "info", text: "Added to cart." }],
    };
  }
  const bar = await getBar(barId);
  const items = await listItems({ barId, menuId: publishedMenu.id, categoryId: item.category_id, offset: 0, limit: LIMIT });
  return {
    next_screen_id: "s_items",
    data: {
      bar_id: barId,
      category_id: item.category_id,
      items: items.map((itm) => ({
        id: itm.id,
        title: `${itm.name} — ${fmtCurrency(itm.price_minor ?? 0, itm.currency ?? bar?.currency ?? "RWF")}`,
        description: itm.short_description ?? "",
      })),
      page_token_next: items.length === LIMIT ? encodePageToken(LIMIT) : null,
      page_token_prev: null,
    },
    messages: [{ level: "info", text: "Added to cart." }],
  };
}

async function viewCart(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barId = extractBarId(req);
  const waId = req.wa_id;
  if (!barId || !waId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing context" }],
    };
  }
  const customer = await ensureCustomer(waId);
  const cart = await ensureCart(customer.id, barId);
  const bar = await getBar(barId);
  const totals = await repriceCart(cart.id, barId);
  const summary = await getCartSummary(cart.id, bar?.currency ?? "RWF");
  return {
    next_screen_id: "s_cart_view",
    data: {
      bar_id: barId,
      cart_id: cart.id,
      cart_summary_text: summary.lines || "Cart is empty",
      subtotal: fmtCurrency(totals.subtotal, bar?.currency ?? "RWF"),
      service_charge: fmtCurrency(totals.serviceCharge, bar?.currency ?? "RWF"),
      total: fmtCurrency(totals.total, bar?.currency ?? "RWF"),
      is_empty: summary.count === 0,
    },
  };
}

async function editCart(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const cartId = typeof req.fields?.cart_id === "string" ? req.fields.cart_id : undefined;
  const barId = extractBarId(req);
  if (!cartId || !barId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing cart" }],
    };
  }
  const { data, error } = await supabase
    .from("cart_items")
    .select("id, item_name, qty")
    .eq("cart_id", cartId);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to load cart" }],
    };
  }
  return {
    next_screen_id: "s_cart_edit",
    data: {
      bar_id: barId,
      cart_id: cartId,
      lines: (data ?? []).map((line) => ({ id: line.id, title: `${line.item_name} (${line.qty})` })),
    },
  };
}

async function updateCartLine(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const cartId = typeof req.fields?.cart_id === "string" ? req.fields.cart_id : undefined;
  const barId = extractBarId(req);
  const lineId = typeof req.fields?.line_id === "string" ? req.fields.line_id : undefined;
  const qty = parseInt(String(req.fields?.new_qty ?? "0"), 10) || 0;
  if (!cartId || !barId || !lineId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing parameters" }],
    };
  }
  if (qty <= 0) {
    await removeCartLine(lineId);
  } else {
    await updateCartLineQty(lineId, qty);
  }
  const totals = await repriceCart(cartId, barId);
  const bar = await getBar(barId);
  const totalsText = formatTotals(
    totals.subtotal,
    totals.serviceCharge,
    totals.total,
    bar?.currency ?? "RWF",
  );
  const summary = await getCartSummary(cartId, bar?.currency ?? "RWF");
  return {
    next_screen_id: "s_cart_view",
    data: {
      bar_id: barId,
      cart_id: cartId,
      cart_summary_text: summary.lines || "Cart is empty",
      subtotal: fmtCurrency(totals.subtotal, bar?.currency ?? "RWF"),
      service_charge: fmtCurrency(totals.serviceCharge, bar?.currency ?? "RWF"),
      total: fmtCurrency(totals.total, bar?.currency ?? "RWF"),
      is_empty: summary.count === 0,
      totals_text: totalsText,
    },
  };
}

async function placeOrder(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const barId = extractBarId(req);
  const waId = req.wa_id;
  const cartId = typeof req.fields?.cart_id === "string" ? req.fields.cart_id : undefined;
  const tableLabel = typeof req.fields?.table_label === "string" ? req.fields.table_label : undefined;
  const note = typeof req.fields?.note === "string" ? req.fields.note : undefined;
  if (!barId || !waId || !cartId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing context" }],
    };
  }
  const customer = await ensureCustomer(waId);
  const cart = await supabase
    .from("carts")
    .select("id, customer_id, subtotal_minor, service_charge_minor, total_minor")
    .eq("id", cartId)
    .maybeSingle();
  if (cart.error || !cart.data) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Cart not found" }],
    };
  }
  await supabase.from("carts").update({ status: "locked", table_label: tableLabel ?? null }).eq("id", cartId);
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      bar_id: barId,
      customer_id: cart.data.customer_id ?? customer.id,
      source_cart_id: cartId,
      table_label: tableLabel ?? null,
      subtotal_minor: cart.data.subtotal_minor ?? 0,
      service_charge_minor: cart.data.service_charge_minor ?? 0,
      total_minor: cart.data.total_minor ?? 0,
      note: note ?? null,
      currency: (await getBar(barId))?.currency ?? "RWF",
    })
    .select("id, order_code, total_minor, currency")
    .single();
  if (orderErr || !order) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to create order" }],
    };
  }
  await copyCartItemsToOrder(cartId, order.id);
  await supabase.from("order_events").insert({
    order_id: order.id,
    event_type: "created",
    actor_type: "customer",
  });
  await notifyOrderCreated({
    orderId: order.id,
    barId,
    orderCode: order.order_code,
    totalMinor: order.total_minor ?? 0,
    currency: order.currency ?? "RWF",
    table: tableLabel,
  });
  const bar = await getBar(barId);
  const payment = buildPaymentPayload({ momoCode: bar?.momo_code, totalMinor: order.total_minor ?? 0, currency: order.currency ?? (bar?.currency ?? "RWF") });
  return {
    next_screen_id: "s_payment",
    data: {
      order_id: order.id,
      order_code: order.order_code,
      total_formatted: fmtCurrency(order.total_minor ?? 0, order.currency ?? "RWF"),
      ussd_code_text: payment.ussd_code_text,
      ussd_uri: payment.ussd_uri,
    },
  };
}

async function customerPaid(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const orderId = typeof req.fields?.order_id === "string" ? req.fields.order_id : undefined;
  if (!orderId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing order id" }],
    };
  }
  await supabase.from("order_events").insert({
    order_id: orderId,
    event_type: "customer_paid_signal",
    actor_type: "customer",
  });
  return {
    next_screen_id: "s_order_status",
    messages: [{ level: "info", text: "Payment acknowledged. Waiting for bar confirmation." }],
  };
}

async function viewStatus(req: FlowExchangeRequest): Promise<FlowExchangeResponse> {
  const orderId = typeof req.fields?.order_id === "string" ? req.fields.order_id : undefined;
  if (!orderId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing order" }],
    };
  }
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_code, status, total_minor, currency, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Order not found" }],
    };
  }
  const timeline = await orderTimeline(orderId);
  return {
    next_screen_id: "s_order_status",
    data: {
      order_id: orderId,
      status: data.status,
      timeline_text: timeline,
    },
  };
}

async function getItem(itemId: string) {
  const { data, error } = await supabase
    .from("items")
    .select("id, bar_id, category_id, name, short_description, price_minor, currency, flags")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function copyCartItemsToOrder(cartId: string, orderId: string): Promise<void> {
  const { data, error } = await supabase
    .from("cart_items")
    .select("item_id, item_name, item_snapshot, qty, unit_price_minor, flags_snapshot, modifiers_snapshot, line_total_minor")
    .eq("cart_id", cartId);
  if (error) throw error;
  if (!data?.length) return;
  const rows = data.map((line) => ({
    order_id: orderId,
    item_id: line.item_id,
    item_name: line.item_name,
    item_description: line.item_snapshot?.description ?? null,
    qty: line.qty,
    unit_price_minor: line.unit_price_minor,
    flags_snapshot: line.flags_snapshot,
    modifiers_snapshot: line.modifiers_snapshot,
    line_total_minor: line.line_total_minor,
  }));
  const { error: insertErr } = await supabase.from("order_items").insert(rows);
  if (insertErr) throw insertErr;
}
