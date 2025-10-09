import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import {
  buildPaymentPayload,
  decodePageToken,
  encodePageToken,
  ensureCart,
  ensureProfile,
  ensureSession,
  extractBarId,
  formatTotals,
  getBar,
  getCartSummary,
  getCategory,
  getPublishedMenu,
  listCategories,
  listItems,
  listSubcategories,
  orderTimeline,
  removeCartLine,
  repriceCart,
  resolveItemModifiers,
  sortCartModifiers,
  updateCartLineQty,
  upsertCartItem,
} from "../helpers.ts";
import { fmtCurrency } from "../../utils/text.ts";
import { notifyOrderCreated } from "../../notify/hooks.ts";
import type {
  CartModifierSnapshot,
  ItemModifierDef,
  ItemModifierOptionDef,
} from "../helpers.ts";

const LIMIT = 10;

export async function handleCustomerBarMenu(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_open_menu":
      return await openMenu(req);
    case "a_select_category":
      return await refreshCategories(req);
    case "a_select_subcategory":
      return await listMenuItems(req, 0);
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
        messages: [{
          level: "warning",
          text: `Unknown action ${req.action_id}`,
        }],
      };
  }
}

async function openMenu(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
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
  await ensureSession({
    waId: req.wa_id,
    role: "customer",
    barId,
    currentFlow: req.flow_id,
  });
  const [categories, subcategoryProbe] = await Promise.all([
    listCategories(barId, publishedMenu.id),
    supabase
      .from("categories")
      .select("id")
      .eq("bar_id", barId)
      .eq("menu_id", publishedMenu.id)
      .not("parent_category_id", "is", null)
      .limit(1),
  ]);
  const hasSubcategories = Boolean(
    subcategoryProbe?.data && subcategoryProbe.data.length > 0,
  );
  return {
    next_screen_id: "s_categories",
    data: {
      bar_id: barId,
      bar_name: bar.name,
      categories: categories.map((cat) => ({ id: cat.id, title: cat.name })),
      has_subcategories: hasSubcategories,
      subcategories: [],
    },
  };
}

async function refreshCategories(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = extractBarId(req);
  const categoryId = typeof req.fields?.category_id === "string"
    ? req.fields.category_id
    : undefined;
  if (!barId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing bar id" }],
    };
  }
  if (!categoryId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing category" }],
    };
  }
  const publishedMenu = await getPublishedMenu(barId);
  if (!publishedMenu) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "warning", text: "Menu not available" }],
    };
  }
  const [category, subcategories] = await Promise.all([
    getCategory(categoryId),
    listSubcategories(barId, publishedMenu.id, categoryId),
  ]);
  if (!category) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Category not found" }],
    };
  }
  if (subcategories.length > 0) {
    return {
      next_screen_id: "s_subcategories",
      data: {
        bar_id: barId,
        category_id: categoryId,
        category_name: category.name,
        subcategories: subcategories.map((sub) => ({
          id: sub.id,
          title: sub.name,
        })),
      },
    };
  }
  return await listMenuItems(req, 0);
}

async function listMenuItems(
  req: FlowExchangeRequest,
  offset: number,
): Promise<FlowExchangeResponse> {
  const barId = extractBarId(req);
  const categoryId = typeof req.fields?.category_id === "string"
    ? req.fields.category_id
    : undefined;
  const subcategoryIdRaw = typeof req.fields?.subcategory_id === "string"
    ? req.fields.subcategory_id
    : undefined;
  const subcategoryId = subcategoryIdRaw?.trim() ? subcategoryIdRaw : undefined;
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
  const [category, subcategory] = await Promise.all([
    getCategory(categoryId),
    subcategoryId ? getCategory(subcategoryId) : Promise.resolve(null),
  ]);
  if (!category) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Category not found" }],
    };
  }
  if (
    subcategoryId &&
    (!subcategory || subcategory.bar_id !== barId ||
      subcategory.parent_category_id !== categoryId)
  ) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Subcategory not found" }],
    };
  }
  const items = await listItems({
    barId,
    menuId: publishedMenu.id,
    categoryId,
    subcategoryId,
    offset,
    limit: LIMIT,
  });
  const rows = items.map((item) => ({
    id: item.id,
    title: `${item.name} — ${
      fmtCurrency(item.price_minor ?? 0, item.currency ?? bar.currency ?? "RWF")
    }`,
    description: item.short_description ?? "",
  }));
  const nextOffset = items.length === LIMIT ? offset + LIMIT : null;
  const prevOffset = offset > 0 ? Math.max(offset - LIMIT, 0) : null;
  const response: FlowExchangeResponse = {
    next_screen_id: "s_items",
    data: {
      bar_id: barId,
      category_id: categoryId,
      category_name: category.name,
      subcategory_id: subcategoryId ?? null,
      subcategory_name: subcategory?.name ?? "",
      items: rows,
      page_token_next: nextOffset !== null ? encodePageToken(nextOffset) : null,
      page_token_prev: prevOffset !== null ? encodePageToken(prevOffset) : null,
    },
  };
  if (rows.length === 0) {
    response.messages = [{ level: "info", text: "No items available yet." }];
  }
  return response;
}

async function openItem(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const itemId = typeof req.fields?.item_id === "string"
    ? req.fields.item_id
    : undefined;
  if (!itemId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing item id" }],
    };
  }
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, bar_id, menu_id, category_id, name, short_description, price_minor, currency, flags, metadata",
    )
    .eq("id", itemId)
    .maybeSingle();
  if (error || !data) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Item not found" }],
    };
  }
  const modifiers = await resolveItemModifiers(itemId, data.metadata);
  const currency = data.currency ?? "RWF";
  const modifierOptions = buildModifierOptions(modifiers, currency);
  const modifierInfoText = buildModifierInfoText(modifiers);
  return {
    next_screen_id: "s_item_detail",
    data: {
      bar_id: data.bar_id,
      item_id: data.id,
      item_name: data.name,
      item_description: data.short_description ?? "",
      item_price: fmtCurrency(data.price_minor ?? 0, currency),
      modifier_options: modifierOptions,
      modifier_options_count: modifierOptions.length,
      modifier_info_text: modifierInfoText,
    },
  };
}

async function addToCart(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = extractBarId(req);
  const itemId = typeof req.fields?.item_id === "string"
    ? req.fields.item_id
    : undefined;
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
  const modifierDefs = await resolveItemModifiers(itemId, item.metadata);
  const selectionValues = parseModifierSelection(req.fields?.modifier_ids);
  const selectionMap = buildModifierSelectionMap(selectionValues, modifierDefs);
  if (typeof selectionMap === "string") {
    return await reopenItemWithError(req, selectionMap);
  }
  const finalized = finalizeModifierSelection(selectionMap, modifierDefs);
  if (typeof finalized === "string") {
    return await reopenItemWithError(req, finalized);
  }
  const { appliedModifiers, modifierTotal } = finalized;
  const customer = await ensureProfile(waId);
  await ensureSession({
    waId,
    role: "customer",
    barId,
    profileId: customer.id,
    currentFlow: req.flow_id,
  });
  const cart = await ensureCart(customer.id, barId);
  const basePrice = Number(item.price_minor ?? 0);
  const unitPrice = basePrice + modifierTotal;
  await upsertCartItem({
    cartId: cart.id,
    item,
    qty,
    unitPriceMinor: unitPrice,
    modifiers: appliedModifiers,
  });
  await repriceCart(cart.id, barId);
  const publishedMenu = await getPublishedMenu(barId);
  if (!publishedMenu) {
    return {
      next_screen_id: "s_items",
      messages: [{ level: "info", text: "Added to cart." }],
    };
  }
  const categoryRow = item.category_id
    ? await getCategory(item.category_id)
    : null;
  const [bar, parentCategory] = await Promise.all([
    getBar(barId),
    categoryRow?.parent_category_id
      ? getCategory(categoryRow.parent_category_id)
      : Promise.resolve(null),
  ]);
  let categoryIdForData = categoryRow?.parent_category_id ?? categoryRow?.id ??
    item.category_id;
  let categoryName = parentCategory?.name ?? categoryRow?.name ?? "";
  let subcategoryId: string | null = null;
  let subcategoryName = "";
  if (categoryRow?.parent_category_id) {
    subcategoryId = categoryRow.id;
    subcategoryName = categoryRow.name ?? "";
  } else if (categoryRow?.id) {
    categoryIdForData = categoryRow.id;
    categoryName = categoryRow.name ?? categoryName;
  }
  if (!categoryIdForData) {
    categoryIdForData = item.category_id;
  }
  const items = await listItems({
    barId,
    menuId: publishedMenu.id,
    categoryId: categoryIdForData,
    subcategoryId,
    offset: 0,
    limit: LIMIT,
  });
  const modifierLabel = buildModifierSummary(appliedModifiers);
  return {
    next_screen_id: "s_items",
    data: {
      bar_id: barId,
      category_id: categoryIdForData,
      category_name: categoryName,
      subcategory_id: subcategoryId,
      subcategory_name: subcategoryName,
      items: items.map((itm) => ({
        id: itm.id,
        title: `${itm.name} — ${
          fmtCurrency(
            itm.price_minor ?? 0,
            itm.currency ?? bar?.currency ?? "RWF",
          )
        }`,
        description: itm.short_description ?? "",
      })),
      page_token_next: items.length === LIMIT ? encodePageToken(LIMIT) : null,
      page_token_prev: null,
    },
    messages: [{
      level: "info",
      text: `Added ${qty}x ${item.name}${modifierLabel} to cart.`,
    }],
  };
}

async function viewCart(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = extractBarId(req);
  const waId = req.wa_id;
  if (!barId || !waId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing context" }],
    };
  }
  const customer = await ensureProfile(waId);
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

async function editCart(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const cartId = typeof req.fields?.cart_id === "string"
    ? req.fields.cart_id
    : undefined;
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
      lines: (data ?? []).map((line) => ({
        id: line.id,
        title: `${line.item_name} (${line.qty})`,
      })),
    },
  };
}

async function updateCartLine(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const cartId = typeof req.fields?.cart_id === "string"
    ? req.fields.cart_id
    : undefined;
  const barId = extractBarId(req);
  const lineId = typeof req.fields?.line_id === "string"
    ? req.fields.line_id
    : undefined;
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

async function placeOrder(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = extractBarId(req);
  const waId = req.wa_id;
  const cartId = typeof req.fields?.cart_id === "string"
    ? req.fields.cart_id
    : undefined;
  const tableLabel = typeof req.fields?.table_label === "string"
    ? req.fields.table_label
    : undefined;
  const note = typeof req.fields?.note === "string"
    ? req.fields.note
    : undefined;
  if (!barId || !waId || !cartId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing context" }],
    };
  }
  const customer = await ensureProfile(waId);
  const cart = await supabase
    .from("carts")
    .select(
      "id, profile_id, subtotal_minor, service_charge_minor, total_minor",
    )
    .eq("id", cartId)
    .maybeSingle();
  if (cart.error || !cart.data) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Cart not found" }],
    };
  }
  await supabase.from("carts").update({
    status: "locked",
    table_label: tableLabel ?? null,
  }).eq("id", cartId);
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      bar_id: barId,
      profile_id: cart.data.profile_id ?? customer.id,
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
  const payment = buildPaymentPayload({
    momoCode: bar?.momo_code,
    totalMinor: order.total_minor ?? 0,
    currency: order.currency ?? (bar?.currency ?? "RWF"),
  });
  return {
    next_screen_id: "s_payment",
    data: {
      order_id: order.id,
      order_code: order.order_code,
      total_formatted: fmtCurrency(
        order.total_minor ?? 0,
        order.currency ?? "RWF",
      ),
      ussd_code_text: payment.ussd_code_text,
      ussd_uri: payment.ussd_uri,
    },
  };
}

async function customerPaid(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const orderId = typeof req.fields?.order_id === "string"
    ? req.fields.order_id
    : undefined;
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
    messages: [{
      level: "info",
      text: "Payment acknowledged. Waiting for bar confirmation.",
    }],
  };
}

async function viewStatus(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const orderId = typeof req.fields?.order_id === "string"
    ? req.fields.order_id
    : undefined;
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
    .select(
      "id, bar_id, menu_id, category_id, name, short_description, price_minor, currency, flags, metadata",
    )
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

type ModifierSelection = {
  modifier: ItemModifierDef;
  option: ItemModifierOptionDef;
};

function parseModifierSelection(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => parseModifierSelection(entry));
  }
  if (typeof raw === "string" && raw.length) {
    return raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (raw === null || raw === undefined) return [];
  const value = String(raw).trim();
  return value.length ? [value] : [];
}

function buildModifierSelectionMap(
  selectionIds: string[],
  modifiers: ItemModifierDef[],
): Map<string, ModifierSelection[]> | string {
  const map = new Map<string, ModifierSelection[]>();
  const modifierIndex = new Map(modifiers.map((mod) => [mod.id, mod]));
  const seen = new Set<string>();
  for (const rawId of selectionIds) {
    if (!rawId) continue;
    const [modifierId, optionId] = rawId.split(":");
    if (!modifierId || !optionId) continue;
    const modifier = modifierIndex.get(modifierId);
    if (!modifier) {
      return "The selected options are no longer available. Please reopen the item.";
    }
    const option = modifier.options.find((opt) => opt.id === optionId);
    if (!option) {
      return "The selected options are no longer available. Please reopen the item.";
    }
    const fingerprint = `${modifier.id}:${option.id}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    const existing = map.get(modifier.id) ?? [];
    existing.push({ modifier, option });
    map.set(modifier.id, existing);
  }
  return map;
}

function finalizeModifierSelection(
  selectionMap: Map<string, ModifierSelection[]>,
  modifiers: ItemModifierDef[],
):
  | { appliedModifiers: CartModifierSnapshot[]; modifierTotal: number }
  | string {
  const applied: CartModifierSnapshot[] = [];
  let modifierTotal = 0;

  for (const modifier of modifiers) {
    let selections = selectionMap.get(modifier.id) ?? [];
    if (!selections.length) {
      const defaults = modifier.options.filter((opt) => opt.is_default);
      if (defaults.length) {
        selections = defaults.map((option) => ({ modifier, option }));
        selectionMap.set(modifier.id, selections);
      }
    }
    if (modifier.is_required && selections.length === 0) {
      return `Please choose at least one option for ${modifier.name}.`;
    }
    if (modifier.modifier_type === "single" && selections.length > 1) {
      return `Choose only one option for ${modifier.name}.`;
    }
    // Deduplicate selections for safety
    const unique = new Map<string, ModifierSelection>();
    for (const entry of selections) {
      if (!unique.has(entry.option.id)) {
        unique.set(entry.option.id, entry);
      }
    }
    selectionMap.set(modifier.id, Array.from(unique.values()));
  }

  for (const entries of selectionMap.values()) {
    for (const { modifier, option } of entries) {
      const delta = Number(option.price_delta_minor ?? 0) || 0;
      modifierTotal += delta;
      applied.push({
        modifier_id: modifier.id,
        modifier_name: modifier.name,
        option_id: option.id,
        option_name: option.name,
        price_delta_minor: delta,
      });
    }
  }

  return {
    appliedModifiers: sortCartModifiers(applied),
    modifierTotal,
  };
}

function buildModifierSummary(modifiers: CartModifierSnapshot[]): string {
  if (!modifiers.length) return "";
  const summary = modifiers
    .map((mod) => `${mod.modifier_name}: ${mod.option_name}`)
    .join(", ");
  return summary.length ? ` (${summary})` : "";
}

function buildModifierOptions(
  modifiers: ItemModifierDef[],
  currency: string,
) {
  const rows: Array<{ id: string; title: string; description?: string }> = [];
  for (const modifier of modifiers) {
    const requirement = modifier.is_required
      ? modifier.modifier_type === "single"
        ? "Required"
        : "Required, multiple allowed"
      : modifier.modifier_type === "single"
      ? "Optional"
      : "Optional, multiple allowed";
    for (const option of modifier.options) {
      const deltaText = option.price_delta_minor
        ? ` (+${fmtCurrency(option.price_delta_minor, currency)})`
        : "";
      rows.push({
        id: `${modifier.id}:${option.id}`,
        title: `${modifier.name} — ${option.name}${deltaText}`,
        description: requirement,
      });
    }
  }
  return rows;
}

function buildModifierInfoText(modifiers: ItemModifierDef[]): string {
  if (!modifiers.length) return "";
  return modifiers.map((modifier) => {
    if (modifier.is_required) {
      return modifier.modifier_type === "single"
        ? `${modifier.name}: choose 1 option (required).`
        : `${modifier.name}: choose at least 1 option (required).`;
    }
    return modifier.modifier_type === "single"
      ? `${modifier.name}: optional (choose up to 1).`
      : `${modifier.name}: optional (choose any).`;
  }).join("\n");
}

async function reopenItemWithError(
  req: FlowExchangeRequest,
  message: string,
): Promise<FlowExchangeResponse> {
  const detail = await openItem(req);
  const errorMessage = { level: "error" as const, text: message };
  detail.messages = detail.messages
    ? [...detail.messages, errorMessage]
    : [errorMessage];
  return detail;
}

async function copyCartItemsToOrder(
  cartId: string,
  orderId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("cart_items")
    .select(
      "item_id, item_name, item_snapshot, qty, unit_price_minor, flags_snapshot, modifiers_snapshot, line_total_minor",
    )
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
