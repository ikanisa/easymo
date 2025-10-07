import { supabase, WA_BOT_NUMBER_E164 } from "../config.ts";
import type { FlowExchangeRequest } from "../types.ts";
import { buildMomoUssd } from "../utils/momo.ts";
import { fmtCurrency } from "../utils/text.ts";
import {
  CAMELLIA_MANAGER_E164,
  isCamelliaBar,
} from "../domains/dinein/constants.ts";

const PAGE_LIMIT = 10;

type ProfileSummary = {
  id: string;
  wa_id: string;
  display_name: string | null;
};

function normalizeWa(raw: string): string {
  if (!raw) return "";
  return raw.startsWith("+") ? raw : `+${raw}`;
}

type OcrJobStatus = "queued" | "processing" | "succeeded" | "failed";

export type OcrJobSummary = {
  total: number;
  counts: Record<OcrJobStatus, number>;
  lastStatus: OcrJobStatus | null;
  lastRunAt: string | null;
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
  lastSuccessAt: string | null;
};

export type ItemModifierOptionDef = {
  id: string;
  name: string;
  price_delta_minor: number;
  is_default: boolean;
};

export type ItemModifierDef = {
  id: string;
  name: string;
  modifier_type: "single" | "multiple";
  is_required: boolean;
  sort_order: number;
  options: ItemModifierOptionDef[];
};

export type CartModifierSnapshot = {
  modifier_id: string;
  modifier_name: string;
  option_id: string;
  option_name: string;
  price_delta_minor: number;
};

export function decodePageToken(token?: string | null): number {
  if (!token) return 0;
  try {
    const parsed = JSON.parse(atob(token));
    if (typeof parsed?.offset === "number" && parsed.offset >= 0) {
      return parsed.offset;
    }
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

export async function ensureProfile(waId: string): Promise<ProfileSummary> {
  const normalized = normalizeWa(waId);
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { whatsapp_e164: normalized },
      {
        onConflict: "whatsapp_e164",
        defaultToNull: false,
        returning: "representation",
      },
    )
    .select("user_id, whatsapp_e164, display_name")
    .single();
  if (error) throw error;
  const record = data as {
    user_id: string;
    whatsapp_e164: string | null;
    display_name: string | null;
  };
  return {
    id: record.user_id,
    wa_id: record.whatsapp_e164 ?? normalized,
    display_name: record.display_name ?? null,
  };
}

export async function ensureSession(params: {
  waId: string;
  role:
    | "customer"
    | "vendor"
    | "vendor_manager"
    | "vendor_staff"
    | "admin"
    | "system";
  barId?: string;
  profileId?: string;
  currentFlow?: string | null;
  context?: Record<string, unknown>;
}): Promise<void> {
  const normalizedRole = params.role === "vendor"
    ? "vendor_manager"
    : params.role;
  const waId = normalizeWa(params.waId);
  const payload = {
    wa_id: waId,
    role: normalizedRole,
    bar_id: params.barId ?? null,
    profile_id: params.profileId ?? null,
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

export async function getOcrJobSummary(barId: string): Promise<OcrJobSummary> {
  const { data, error, count } = await supabase
    .from("ocr_jobs")
    .select("status, error_message, created_at, updated_at", { count: "exact" })
    .eq("bar_id", barId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = data ?? [];
  const counts: Record<OcrJobStatus, number> = {
    queued: 0,
    processing: 0,
    succeeded: 0,
    failed: 0,
  };
  let lastStatus: OcrJobStatus | null = null;
  let lastRunAt: string | null = null;
  let lastErrorMessage: string | null = null;
  let lastErrorAt: string | null = null;
  let lastSuccessAt: string | null = null;
  for (
    const row of rows as Array<{
      status: string;
      error_message?: string | null;
      created_at?: string | null;
      updated_at?: string | null;
    }>
  ) {
    const status = String(row.status ?? "");
    if (
      status === "queued" || status === "processing" ||
      status === "succeeded" || status === "failed"
    ) {
      counts[status] = (counts[status] ?? 0) + 1;
      const timestamp = row.updated_at ?? row.created_at ?? null;
      if (timestamp && (!lastRunAt || timestamp > lastRunAt)) {
        lastRunAt = timestamp;
        lastStatus = status;
      }
      if (status === "failed" && !lastErrorMessage) {
        lastErrorMessage = row.error_message ?? "Unexpected OCR failure";
        lastErrorAt = row.updated_at ?? row.created_at ?? null;
      }
      if (status === "succeeded" && !lastSuccessAt) {
        lastSuccessAt = row.updated_at ?? row.created_at ?? null;
      }
    }
  }
  return {
    total: count ?? rows.length,
    counts,
    lastStatus,
    lastRunAt,
    lastErrorMessage,
    lastErrorAt,
    lastSuccessAt,
  };
}

export async function promoteDraftToPublished(
  params: { barId: string; draftMenuId?: string | null },
): Promise<string> {
  const { barId, draftMenuId } = params;
  const rpcPayload: Record<string, string | null> = {
    _bar_id: barId,
    _draft_menu_id: draftMenuId ?? null,
  };
  const { data, error } = await supabase.rpc<string>(
    "menu_admin.promote_draft_menu",
    rpcPayload,
  );
  if (error) throw error;
  if (!data) throw new Error("Failed to promote draft menu");
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

export async function listSubcategories(
  barId: string,
  menuId: string,
  parentCategoryId: string,
) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .eq("bar_id", barId)
    .eq("menu_id", menuId)
    .eq("parent_category_id", parentCategoryId)
    .eq("is_deleted", false)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCategory(categoryId: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, bar_id, menu_id, parent_category_id, name")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function listItems(params: {
  barId: string;
  menuId: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  offset: number;
  limit?: number;
}) {
  let query = supabase
    .from("items")
    .select(
      "id, name, short_description, price_minor, currency, is_available, flags, metadata",
    )
    .eq("bar_id", params.barId)
    .eq("menu_id", params.menuId)
    .eq("is_available", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  const targetCategoryId = params.subcategoryId ?? params.categoryId;
  if (targetCategoryId) {
    query = query.eq("category_id", targetCategoryId);
  }
  query = query.range(
    params.offset,
    params.offset + ((params.limit ?? PAGE_LIMIT) - 1),
  );
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function ensureCart(profileId: string, barId: string) {
  const { data, error } = await supabase
    .from("carts")
    .select("*")
    .eq("profile_id", profileId)
    .eq("bar_id", barId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  if (data) return data;
  const { data: inserted, error: insertErr } = await supabase
    .from("carts")
    .insert({ profile_id: profileId, bar_id: barId })
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
    .eq("is_active", true)
    .not("verified_at", "is", null);
  if (error) throw error;
  const numbers = new Set((data ?? []).map((row) => row.number_e164));

  const { data: bar, error: barError } = await supabase
    .from("bars")
    .select("slug, name")
    .eq("id", barId)
    .maybeSingle();
  if (barError && barError.code !== "PGRST116") throw barError;
  if (bar && isCamelliaBar({ slug: bar.slug, name: bar.name })) {
    numbers.add(CAMELLIA_MANAGER_E164);
  }

  return Array.from(numbers);
}

export async function upsertCartItem(params: {
  cartId: string;
  item: any;
  qty: number;
  unitPriceMinor?: number;
  modifiers?: CartModifierSnapshot[];
}) {
  const basePrice = Number(params.item.price_minor ?? 0);
  const unitPrice = Number(params.unitPriceMinor ?? basePrice);
  const normalizedModifiers = sortCartModifiers(params.modifiers ?? []);
  const modifiersKey = fingerprintModifiers(normalizedModifiers);
  const snapshot = {
    price_minor: unitPrice,
    base_price_minor: basePrice,
    currency: params.item.currency,
    flags: params.item.flags,
    description: params.item.short_description ?? null,
    modifiers: normalizedModifiers,
  };
  const { data, error } = await supabase
    .from("cart_items")
    .select("id, qty, modifiers_snapshot, unit_price_minor")
    .eq("cart_id", params.cartId)
    .eq("item_id", params.item.id)
    .order("created_at", { ascending: true });
  if (error && error.code !== "PGRST116") throw error;

  const match = (data ?? []).find((row) => {
    const rowModifiers = normalizeModifiersSnapshot(row.modifiers_snapshot);
    if (fingerprintModifiers(rowModifiers) !== modifiersKey) return false;
    const rowUnit = Number(row.unit_price_minor ?? unitPrice);
    return rowUnit === unitPrice;
  });

  if (match) {
    const newQty = match.qty + params.qty;
    const { error: updateErr } = await supabase
      .from("cart_items")
      .update({
        qty: newQty,
        unit_price_minor: unitPrice,
        line_total_minor: newQty * unitPrice,
        flags_snapshot: params.item.flags ?? [],
        modifiers_snapshot: normalizedModifiers,
        item_snapshot: snapshot,
      })
      .eq("id", match.id);
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
        unit_price_minor: unitPrice,
        flags_snapshot: params.item.flags ?? [],
        modifiers_snapshot: normalizedModifiers,
        line_total_minor: params.qty * unitPrice,
      });
    if (insertErr) throw insertErr;
  }
}

export async function repriceCart(
  cartId: string,
  barId: string,
): Promise<{ subtotal: number; serviceCharge: number; total: number }> {
  const { data: items, error } = await supabase
    .from("cart_items")
    .select("line_total_minor")
    .eq("cart_id", cartId);
  if (error) throw error;
  const subtotal = (items ?? []).reduce(
    (sum, line) => sum + (line.line_total_minor ?? 0),
    0,
  );
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
    .update({
      subtotal_minor: subtotal,
      service_charge_minor: serviceCharge,
      total_minor: total,
    })
    .eq("id", cartId);
  if (updateErr) throw updateErr;
  return { subtotal, serviceCharge, total };
}

export async function getCartSummary(
  cartId: string,
  currency: string,
): Promise<{ lines: string; count: number }> {
  const { data, error } = await supabase
    .from("cart_items")
    .select("item_name, qty, line_total_minor, modifiers_snapshot")
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const lines = (data ?? []).map((line) => {
    const modifiers = normalizeModifiersSnapshot(line.modifiers_snapshot);
    const modifierText = modifiers.length
      ? ` (${
        modifiers.map((mod) => `${mod.modifier_name}: ${mod.option_name}`).join(
          ", ",
        )
      })`
      : "";
    return `${line.qty}x ${line.item_name}${modifierText} — ${
      fmtCurrency(line.line_total_minor ?? 0, currency)
    }`;
  }).join("\n");
  return { lines, count: data?.length ?? 0 };
}

export async function removeCartLine(lineId: string): Promise<void> {
  const { error } = await supabase.from("cart_items").delete().eq("id", lineId);
  if (error) throw error;
}

export async function updateCartLineQty(
  lineId: string,
  qty: number,
): Promise<void> {
  if (qty <= 0) {
    await removeCartLine(lineId);
    return;
  }
  const { data, error } = await supabase
    .from("cart_items")
    .select("unit_price_minor")
    .eq("id", lineId)
    .maybeSingle();
  if (error) throw error;
  const unitPrice = Number(data?.unit_price_minor ?? 0);
  const { error: updateErr } = await supabase
    .from("cart_items")
    .update({
      qty,
      line_total_minor: qty * unitPrice,
    })
    .eq("id", lineId);
  if (updateErr) throw updateErr;
}

export function formatTotals(
  subtotal: number,
  service: number,
  total: number,
  currency: string,
): string {
  return `Subtotal: ${fmtCurrency(subtotal, currency)} | Service: ${
    fmtCurrency(service, currency)
  } | Total: ${fmtCurrency(total, currency)}`;
}

export async function getBar(byId: string) {
  const { data, error } = await supabase
    .from("bars")
    .select(
      "id, name, location_text, city_area, country, currency, momo_code, is_active",
    )
    .eq("id", byId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function buildPaymentPayload(
  params: { momoCode?: string | null; totalMinor: number; currency: string },
) {
  const momoTarget = params.momoCode && params.momoCode.trim().length
    ? params.momoCode
    : null;
  if (!momoTarget) {
    return { ussd_code_text: "", ussd_uri: "" };
  }
  const isCode = !momoTarget.startsWith("+") && !momoTarget.startsWith("0");
  const amount = Math.round(params.totalMinor);
  const { ussd, telUri } = buildMomoUssd(momoTarget, isCode, amount);
  return { ussd_code_text: ussd, ussd_uri: telUri };
}

export async function listItemModifiers(
  itemId: string,
): Promise<ItemModifierDef[]> {
  const { data, error } = await supabase
    .from("item_modifiers")
    .select("id, name, modifier_type, is_required, options, sort_order")
    .eq("item_id", itemId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return normalizeModifierDefinitions(data ?? []);
}

export async function resolveItemModifiers(
  itemId: string,
  metadata?: unknown,
): Promise<ItemModifierDef[]> {
  const dbModifiers = await listItemModifiers(itemId);
  if (dbModifiers.length) return dbModifiers;
  return parseMetadataModifiers(metadata);
}

export function sortCartModifiers(
  modifiers: CartModifierSnapshot[],
): CartModifierSnapshot[] {
  return modifiers
    .map((mod) => ({
      modifier_id: String(mod.modifier_id ?? ""),
      modifier_name: String(mod.modifier_name ?? ""),
      option_id: String(mod.option_id ?? ""),
      option_name: String(mod.option_name ?? ""),
      price_delta_minor: Number(mod.price_delta_minor ?? 0),
    }))
    .filter((mod) => mod.modifier_id.length > 0 && mod.option_id.length > 0)
    .sort((a, b) =>
      a.modifier_id.localeCompare(b.modifier_id) ||
      a.option_id.localeCompare(b.option_id)
    );
}

export function normalizeModifiersSnapshot(
  input: unknown,
): CartModifierSnapshot[] {
  if (!Array.isArray(input)) return [];
  return sortCartModifiers(input as CartModifierSnapshot[]);
}

function fingerprintModifiers(modifiers: CartModifierSnapshot[]): string {
  return JSON.stringify(modifiers);
}

function normalizeModifierDefinitions(
  input: unknown[],
): ItemModifierDef[] {
  return input
    .map((value, index) => normalizeModifierDefinition(value, index))
    .filter((def): def is ItemModifierDef => def !== null)
    .sort((a, b) =>
      a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );
}

function normalizeModifierDefinition(
  value: unknown,
  index: number,
): ItemModifierDef | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const idRaw = record.id ?? record.modifier_id ?? record.code;
  const nameRaw = record.name ?? record.title ?? record.label;
  const typeRaw = record.modifier_type ?? record.type;
  const sortRaw = record.sort_order ?? index * 10;
  const optionsRaw = record.options ?? record.choices ?? [];
  const modifierId = typeof idRaw === "string" && idRaw.length
    ? idRaw
    : `mod-${index + 1}`;
  const modifierName = typeof nameRaw === "string" && nameRaw.length
    ? nameRaw
    : `Option ${index + 1}`;
  const modifierType =
    typeof typeRaw === "string" && typeRaw.toLowerCase() === "multiple"
      ? "multiple"
      : "single";
  const isRequired = Boolean(record.is_required ?? record.required ?? false);
  const sortOrder = typeof sortRaw === "number"
    ? sortRaw
    : Number(sortRaw ?? index * 10) || index * 10;
  const options = normalizeModifierOptions(optionsRaw);
  if (!options.length) return null;
  return {
    id: modifierId,
    name: modifierName,
    modifier_type: modifierType,
    is_required: isRequired,
    sort_order: sortOrder,
    options,
  };
}

function normalizeModifierOptions(raw: unknown): ItemModifierOptionDef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value, index) => normalizeModifierOption(value, index))
    .filter((opt): opt is ItemModifierOptionDef => opt !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeModifierOption(
  value: unknown,
  index: number,
): ItemModifierOptionDef | null {
  if (typeof value === "string" && value.length) {
    return {
      id: `opt-${index + 1}`,
      name: value,
      price_delta_minor: 0,
      is_default: false,
    };
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const idRaw = record.id ?? record.code ?? record.value;
  const nameRaw = record.name ?? record.title ?? record.label;
  const priceRaw = record.price_delta_minor ?? record.price_minor ??
    record.price ?? 0;
  const optionId = typeof idRaw === "string" && idRaw.length
    ? idRaw
    : `opt-${index + 1}`;
  const optionName = typeof nameRaw === "string" && nameRaw.length
    ? nameRaw
    : `Option ${index + 1}`;
  const priceDelta = Number(priceRaw ?? 0) || 0;
  const isDefault = Boolean(record.is_default ?? record.default ?? false);
  return {
    id: optionId,
    name: optionName,
    price_delta_minor: priceDelta,
    is_default: isDefault,
  };
}

function parseMetadataModifiers(metadata: unknown): ItemModifierDef[] {
  if (!metadata) return [];
  if (Array.isArray(metadata)) {
    return normalizeModifierDefinitions(metadata as unknown[]);
  }
  if (typeof metadata !== "object") return [];
  const record = metadata as Record<string, unknown>;
  const raw = Array.isArray(record.modifiers)
    ? record.modifiers
    : Array.isArray(record.options)
    ? record.options
    : [];
  return normalizeModifierDefinitions(raw as unknown[]);
}

export type CustomerOrderView = "open" | "history";

export type CustomerOrderListRow = {
  id: string;
  bar_id: string | null;
  bars?: { name?: string | null } | null;
  order_code: string | null;
  status: string | null;
  table_label: string | null;
  total_minor: number | null;
  currency: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function listCustomerOrders(
  profileId: string,
  options?: { view?: CustomerOrderView; limit?: number; offset?: number },
): Promise<{ orders: CustomerOrderListRow[]; hasMore: boolean }> {
  const view = options?.view ?? "open";
  const limit = Math.max(options?.limit ?? PAGE_LIMIT, 1);
  const offset = Math.max(options?.offset ?? 0, 0);
  const fetchLimit = limit + 1;

  let query = supabase
    .from("orders")
    .select(
      "id, bar_id, bars(name), order_code, status, table_label, total_minor, currency, created_at, updated_at",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .range(offset, offset + fetchLimit - 1);

  if (view === "history") {
    query = query.in("status", ["served", "cancelled"]);
  } else {
    query = query.in("status", ["pending", "paid"]);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const orders = hasMore ? rows.slice(0, limit) : rows;
  return { orders, hasMore };
}

export async function orderTimeline(orderId: string) {
  const { data, error } = await supabase
    .from("order_events")
    .select("event_type, actor_type, note, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((event) =>
    `${event.event_type} ${new Date(event.created_at).toLocaleString()}`
  ).join("\n");
}

export async function getOrderCustomer(
  orderId: string,
): Promise<
  {
    order_code: string;
    wa_id: string | null;
    total_minor: number;
    currency: string;
  }
> {
  const { data, error } = await supabase
    .from("orders")
    .select("order_code, total_minor, currency, profile_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) {
    throw error ?? new Error("Order not found");
  }
  let waId: string | null = null;
  const profileId = (data as { profile_id?: string | null }).profile_id ?? null;
  if (profileId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("whatsapp_e164")
      .eq("user_id", profileId)
      .maybeSingle();
    if (profileError && profileError.code !== "PGRST116") {
      throw profileError;
    }
    waId = profile?.whatsapp_e164 ?? null;
  }
  return {
    order_code: data.order_code,
    wa_id: waId,
    total_minor: data.total_minor ?? 0,
    currency: data.currency ?? "RWF",
  };
}
