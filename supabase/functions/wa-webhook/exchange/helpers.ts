import { supabase, WA_BOT_NUMBER_E164 } from "../config.ts";
import type { FlowExchangeRequest } from "../types.ts";
import { buildMomoUssd } from "../utils/momo.ts";
import { fmtCurrency } from "../utils/text.ts";

const PAGE_LIMIT = 10;

export function decodePageToken(token?: string | null): number {
  if (!token) return 0;
  try {
    const parsed = JSON.parse(atob(token));
    if (typeof parsed?.offset === "number" && parsed.offset >= 0) return parsed.offset;
  } catch (_) {
    // ignore
  }
  return 0;
}

export function encodePageToken(offset: number): string {
  return btoa(JSON.stringify({ offset }));
}

export function extractBarId(req: FlowExchangeRequest): string | undefined {
  const fromFields = req.fields?.bar_id;
  if (typeof fromFields === "string" && fromFields.length) return fromFields;
  const fromFilters = req.filters?.bar_id;
  if (typeof fromFilters === "string" && fromFilters.length) return fromFilters;
  const fromContext = req.context?.bar_id;
  if (typeof fromContext === "string" && fromContext.length) return fromContext;
  return undefined;
}

export async function ensureCustomer(waId: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("id, wa_id, display_name")
    .eq("wa_id", waId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  if (data) return data;
  const { data: inserted, error: insertErr } = await supabase
    .from("customers")
    .insert({ wa_id: waId })
    .select("id, wa_id, display_name")
    .single();
  if (insertErr) throw insertErr;
  return inserted;
}

export async function ensureSession(params: {
  waId: string;
  role: "customer" | "vendor" | "admin" | "system";
  barId?: string;
  customerId?: string;
  currentFlow?: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  const payload = {
    wa_id: params.waId,
    role: params.role,
    bar_id: params.barId ?? null,
    customer_id: params.customerId ?? null,
    current_flow: params.currentFlow ?? null,
    context: params.context ?? {},
    flow_state: {},
  };
  const { error } = await supabase
    .from("sessions")
    .upsert(payload, { onConflict: "wa_id,role" });
  if (error) throw error;
}

export async function getPublishedMenu(barId: string) {
  const { data, error } = await supabase
    .from("published_menus")
    .select("id, bar_id, version")
    .eq("bar_id", barId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function listCategories(barId: string, menuId: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .eq("bar_id", barId)
    .eq("menu_id", menuId)
    .is("parent_category_id", null)
    .eq("is_deleted", false)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listItems(params: {
  barId: string;
  menuId: string;
  categoryId?: string | null;
  offset: number;
  limit?: number;
}) {
  let query = supabase
    .from("items")
    .select("id, name, short_description, price_minor, currency, is_available, flags, metadata")
    .eq("bar_id", params.barId)
    .eq("menu_id", params.menuId)
    .eq("is_available", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }
  query = query.range(params.offset, params.offset + ((params.limit ?? PAGE_LIMIT) - 1));
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function ensureCart(customerId: string, barId: string) {
  const { data, error } = await supabase
    .from("carts")
    .select("*")
    .eq("customer_id", customerId)
    .eq("bar_id", barId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  if (data) return data;
  const { data: inserted, error: insertErr } = await supabase
    .from("carts")
    .insert({ customer_id: customerId, bar_id: barId })
    .select("*")
    .single();
  if (insertErr) throw insertErr;
  return inserted;
}

export async function listVendorNumbers(barId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("bar_numbers")
    .select("number_e164")
    .eq("bar_id", barId)
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []).map((row) => row.number_e164);
}

export async function upsertCartItem(params: {
  cartId: string;
  item: any;
  qty: number;
  modifiers?: unknown[];
}) {
  const snapshot = {
    price_minor: params.item.price_minor,
    currency: params.item.currency,
    flags: params.item.flags,
    description: params.item.short_description ?? null,
  };
  const lineTotal = params.qty * params.item.price_minor;
  const { data, error } = await supabase
    .from("cart_items")
    .select("id, qty")
    .eq("cart_id", params.cartId)
    .eq("item_id", params.item.id)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  if (data) {
    const { error: updateErr } = await supabase
      .from("cart_items")
      .update({
        qty: data.qty + params.qty,
        unit_price_minor: params.item.price_minor,
        line_total_minor: (data.qty + params.qty) * params.item.price_minor,
        flags_snapshot: params.item.flags ?? [],
        modifiers_snapshot: params.modifiers ?? [],
        item_snapshot: snapshot,
      })
      .eq("id", data.id);
    if (updateErr) throw updateErr;
  } else {
    const { error: insertErr } = await supabase
      .from("cart_items")
      .insert({
        cart_id: params.cartId,
        item_id: params.item.id,
        item_name: params.item.name,
        item_snapshot: snapshot,
        qty: params.qty,
        unit_price_minor: params.item.price_minor,
        flags_snapshot: params.item.flags ?? [],
        modifiers_snapshot: params.modifiers ?? [],
        line_total_minor: lineTotal,
      });
    if (insertErr) throw insertErr;
  }
}

export async function repriceCart(cartId: string, barId: string): Promise<{ subtotal: number; serviceCharge: number; total: number }> {
  const { data: items, error } = await supabase
    .from("cart_items")
    .select("line_total_minor")
    .eq("cart_id", cartId);
  if (error) throw error;
  const subtotal = (items ?? []).reduce((sum, line) => sum + (line.line_total_minor ?? 0), 0);
  const { data: settings, error: settingsErr } = await supabase
    .from("bar_settings")
    .select("service_charge_pct")
    .eq("bar_id", barId)
    .maybeSingle();
  if (settingsErr && settingsErr.code !== "PGRST116") throw settingsErr;
  const servicePct = parseFloat(settings?.service_charge_pct ?? "0");
  const serviceCharge = Math.round(subtotal * (servicePct / 100));
  const total = subtotal + serviceCharge;
  const { error: updateErr } = await supabase
    .from("carts")
    .update({ subtotal_minor: subtotal, service_charge_minor: serviceCharge, total_minor: total })
    .eq("id", cartId);
  if (updateErr) throw updateErr;
  return { subtotal, serviceCharge, total };
}

export async function getCartSummary(cartId: string, currency: string): Promise<{ lines: string; count: number }> {
  const { data, error } = await supabase
    .from("cart_items")
    .select("item_name, qty, line_total_minor")
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const lines = (data ?? []).map((line) => `${line.qty}x ${line.item_name} — ${fmtCurrency(line.line_total_minor ?? 0, currency)}`).join("\n");
  return { lines, count: data?.length ?? 0 };
}

export async function removeCartLine(lineId: string): Promise<void> {
  const { error } = await supabase.from("cart_items").delete().eq("id", lineId);
  if (error) throw error;
}

export async function updateCartLineQty(lineId: string, qty: number): Promise<void> {
  if (qty <= 0) {
    await removeCartLine(lineId);
    return;
  }
  const { data, error } = await supabase
    .from("cart_items")
    .select("item_snapshot->>price_minor")
    .eq("id", lineId)
    .maybeSingle();
  if (error) throw error;
  const unitPrice = parseInt(data?.["item_snapshot->>price_minor"] ?? "0", 10);
  const { error: updateErr } = await supabase
    .from("cart_items")
    .update({
      qty,
      line_total_minor: qty * unitPrice,
    })
    .eq("id", lineId);
  if (updateErr) throw updateErr;
}

export function formatTotals(subtotal: number, service: number, total: number, currency: string): string {
  return `Subtotal: ${fmtCurrency(subtotal, currency)} | Service: ${fmtCurrency(service, currency)} | Total: ${fmtCurrency(total, currency)}`;
}

export async function getBar(byId: string) {
  const { data, error } = await supabase
    .from("bars")
    .select("id, name, location_text, city_area, country, currency, momo_code, is_active")
    .eq("id", byId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function buildPaymentPayload(params: { momoCode?: string | null; totalMinor: number; currency: string }) {
  const momoTarget = params.momoCode && params.momoCode.trim().length ? params.momoCode : null;
  if (!momoTarget) {
    return { ussd_code_text: "", ussd_uri: "" };
  }
  const isCode = !momoTarget.startsWith("+") && !momoTarget.startsWith("0");
  const amount = Math.round(params.totalMinor);
  const { ussd, telUri } = buildMomoUssd(momoTarget, isCode, amount);
  return { ussd_code_text: ussd, ussd_uri: telUri };
}

export async function listCustomerOrders(customerId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_code, status, table_label, total_minor, currency, created_at")
    .eq("customer_id", customerId)
    .not("status", "eq", "served")
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

export async function orderTimeline(orderId: string) {
  const { data, error } = await supabase
    .from("order_events")
    .select("event_type, actor_type, note, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((event) => `${event.event_type} ${new Date(event.created_at).toLocaleString()}`).join("\n");
}

export async function getOrderCustomer(orderId: string): Promise<{ order_code: string; wa_id: string | null; total_minor: number; currency: string }> {
  const { data, error } = await supabase
    .from("orders")
    .select("order_code, total_minor, currency, customers(wa_id)")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) {
    throw error ?? new Error("Order not found");
  }
  return {
    order_code: data.order_code,
    wa_id: data.customers?.wa_id ?? null,
    total_minor: data.total_minor ?? 0,
    currency: data.currency ?? "RWF",
  };
}
