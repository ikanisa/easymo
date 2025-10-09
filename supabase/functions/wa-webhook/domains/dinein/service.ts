import type { SupabaseClient } from "../../deps.ts";
import {
  CAMELLIA_MANAGER_E164,
  CAMELLIA_MOMO_CODE,
  isCamelliaBar,
} from "./constants.ts";

const DEFAULT_MANAGER_E164 = "+250795588248";

const DEFAULT_CURRENCY = "RWF";

export type BarProfile = {
  id: string;
  slug: string;
  name: string;
  location: string;
  currency: string;
  servicePct: number;
  momoCode: string | null;
  paymentInstructions: string | null;
  isCamellia: boolean;
};

export type ItemRecord = {
  id: string;
  bar_id: string;
  menu_id: string;
  name: string;
  short_description: string | null;
  price_minor: number;
  currency: string | null;
  is_available: boolean;
  flags: unknown;
  category_name?: string | null;
};

export type OrderSnapshot = {
  orderId: string;
  orderCode: string;
  subtotalMinor: number;
  serviceMinor: number;
  totalMinor: number;
  currency: string;
  servicePct: number;
  bar: BarProfile;
};

export async function getOrCreateCustomerId(
  supabase: SupabaseClient,
  waId: string,
): Promise<string> {
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
    .select("user_id")
    .single();
  if (error) throw error;
  return (data as { user_id: string }).user_id;
}

export async function fetchBarProfile(
  supabase: SupabaseClient,
  barId: string,
): Promise<BarProfile | null> {
  const { data, error } = await supabase
    .from("bars")
    .select(
      "id, slug, name, location_text, city_area, country, currency, momo_code, bar_settings(service_charge_pct, payment_instructions)",
    )
    .eq("id", barId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;
  const location = buildLocation([
    data.location_text,
    data.city_area,
    data.country,
  ]);
  const currency = data.currency ?? DEFAULT_CURRENCY;
  const servicePct = Number(data.bar_settings?.service_charge_pct ?? 0);
  const slug = (data.slug ?? data.id ?? "").toLowerCase();
  const isCamellia = isCamelliaBar({ slug, name: data.name });
  return {
    id: data.id,
    slug,
    name: data.name,
    location,
    currency,
    servicePct,
    momoCode: data.momo_code ?? null,
    paymentInstructions: data.bar_settings?.payment_instructions ?? null,
    isCamellia,
  };
}

export async function fetchItem(
  supabase: SupabaseClient,
  itemId: string,
): Promise<ItemRecord | null> {
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, bar_id, menu_id, name, short_description, price_minor, currency, is_available, flags, categories(name)",
    )
    .eq("id", itemId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;
  return {
    ...data,
    category_name: data.categories?.name ?? null,
  };
}

export async function createInstantOrder(
  supabase: SupabaseClient,
  params: {
    profileId: string;
    bar: BarProfile;
    item: ItemRecord;
    quantity?: number;
  },
): Promise<OrderSnapshot> {
  const quantity = Math.max(1, Math.trunc(params.quantity ?? 1));
  const subtotalMinor = quantity * params.item.price_minor;
  const serviceMinor = Math.round(
    subtotalMinor * (params.bar.servicePct / 100),
  );
  const totalMinor = subtotalMinor + serviceMinor;
  const currency = params.item.currency ?? params.bar.currency ??
    DEFAULT_CURRENCY;
  const orderCode = crypto.randomUUID().slice(0, 8).toUpperCase();

  const effectiveMomoCode = getEffectiveMomoCode(params.bar);

  const { data: orderRow, error } = await supabase
    .from("orders")
    .insert({
      order_code: orderCode,
      bar_id: params.bar.id,
      profile_id: params.profileId,
      subtotal_minor: subtotalMinor,
      service_charge_minor: serviceMinor,
      total_minor: totalMinor,
      currency,
      momo_code_used: effectiveMomoCode,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("order_items").insert({
    order_id: orderRow.id,
    item_id: params.item.id,
    item_name: params.item.name,
    item_description: params.item.short_description ?? null,
    qty: quantity,
    unit_price_minor: params.item.price_minor,
    line_total_minor: subtotalMinor,
  });

  await supabase.from("order_events").insert({
    order_id: orderRow.id,
    event_type: "created",
    actor_type: "system",
  });

  return {
    orderId: orderRow.id,
    orderCode,
    subtotalMinor,
    serviceMinor,
    totalMinor,
    currency,
    servicePct: params.bar.servicePct,
    bar: params.bar,
  };
}

export function getEffectiveMomoCode(bar: BarProfile): string | null {
  if (bar.isCamellia) return CAMELLIA_MOMO_CODE;
  const direct = bar.momoCode?.trim();
  if (direct) return direct;
  return null;
}

export function getManagerNumbers(bar: BarProfile): string[] {
  const numbers: string[] = [];
  numbers.push(normalizeWa(DEFAULT_MANAGER_E164));
  if (bar.isCamellia) numbers.push(normalizeWa(CAMELLIA_MANAGER_E164));
  return Array.from(new Set(numbers));
}

export async function fetchBarProfileBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<BarProfile | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from("bars")
    .select(
      "id, slug, name, location_text, city_area, country, currency, momo_code, bar_settings(service_charge_pct, payment_instructions)",
    )
    .eq("slug", normalized)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;
  const location = buildLocation([
    data.location_text,
    data.city_area,
    data.country,
  ]);
  const currency = data.currency ?? DEFAULT_CURRENCY;
  const servicePct = Number(data.bar_settings?.service_charge_pct ?? 0);
  const slugValue = data.slug ?? normalized;
  const isCamellia = isCamelliaBar({ slug: slugValue, name: data.name });
  return {
    id: data.id,
    slug: slugValue,
    name: data.name,
    location,
    currency,
    servicePct,
    momoCode: data.momo_code ?? null,
    paymentInstructions: data.bar_settings?.payment_instructions ?? null,
    isCamellia,
  };
}

function normalizeWa(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("+")) {
    return `+${trimmed.replace(/^\++/, "")}`;
  }
  return `+${trimmed.replace(/^\++/, "")}`;
}

function buildLocation(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part && part.length))
    .join(" · ");
}
