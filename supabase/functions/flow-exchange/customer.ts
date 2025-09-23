import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import {
  barSearchFiltersSchema,
  buildInfoResponse,
  buildErrorResponse,
} from './utils.ts';
import type { SupabaseClient } from './types.ts';

const BAR_RESULTS_PAGE_SIZE = 10;
const CATEGORY_PAGE_SIZE = 50;
const ITEM_PAGE_SIZE = 50;

const showResultsSchema = z.object({
  filters: barSearchFiltersSchema.optional(),
  page_token: z.string().nullable().optional(),
});

const barDetailSchema = z.object({
  bar_id: z.string().uuid(),
});

const categoriesSchema = z.object({
  bar_id: z.string().uuid(),
});

const itemsSchema = z.object({
  menu_id: z.string().uuid(),
  category_id: z.string().uuid().optional(),
  subcategory_id: z.string().uuid().optional(),
  page_token: z.string().nullable().optional(),
});

const itemDetailSchema = z.object({
  item_id: z.string().uuid(),
});

export type CustomerRequestPayload = {
  filters?: Record<string, unknown>;
  page_token?: string | null;
  bar_id?: string;
  menu_id?: string;
  category_id?: string;
  subcategory_id?: string;
  wa_id?: string;
  fields?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
};

function resolveField(payload: CustomerRequestPayload, key: string) {
  const fields = payload.fields ?? {};
  const context = payload.context ?? {};
  if (payload[key as keyof CustomerRequestPayload]) {
    return payload[key as keyof CustomerRequestPayload];
  }
  if (typeof fields === 'object' && fields && key in fields) {
    return fields[key];
  }
  if (typeof context === 'object' && context && key in context) {
    return context[key];
  }
  return undefined;
}

async function fetchBars(
  supabase: SupabaseClient,
  filters: z.infer<typeof barSearchFiltersSchema>,
  pageToken: string | null | undefined
) {
  const query = supabase
    .from('bars')
    .select('id, name, location_text, city_area, country, is_active, bar_settings (allow_direct_customer_chat)')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(BAR_RESULTS_PAGE_SIZE + 1);

  if (filters?.q) {
    query.ilike('name', `%${filters.q}%`);
  }
  if (filters?.area) {
    query.ilike('city_area', `%${filters.area}%`);
  }
  if (pageToken) {
    query.gt('name', pageToken);
  }

  const { data, error } = await query;
  if (error) throw error;

  const hasMore = data.length > BAR_RESULTS_PAGE_SIZE;
  const slice = hasMore ? data.slice(0, BAR_RESULTS_PAGE_SIZE) : data;
  const nextToken = hasMore ? slice[slice.length - 1]?.name ?? null : null;

  const bars = slice.map((bar) => ({
    id: bar.id,
    title: bar.name,
    description: formatBarDescription(bar.city_area, bar.country),
    allow_direct_chat: bar.bar_settings?.allow_direct_customer_chat ?? false,
  }));

  return { bars, nextToken };
}

export async function handleShowBarResults(payload: CustomerRequestPayload, supabase: SupabaseClient) {
  const filtersSource = payload.filters ?? (payload.context?.filters as Record<string, unknown> | undefined) ?? {};
  const parsed = showResultsSchema.parse({
    filters: filtersSource,
    page_token: null,
  });
  const { bars, nextToken } = await fetchBars(supabase, parsed.filters ?? {}, parsed.page_token ?? null);

  return buildInfoResponse('s_bar_results', {
    bars,
    q: parsed.filters?.q ?? null,
    area: parsed.filters?.area ?? null,
    page_token_next: nextToken,
  });
}

export async function handlePagedBars(payload: CustomerRequestPayload, supabase: SupabaseClient) {
  const filtersSource = payload.filters ?? (payload.context?.filters as Record<string, unknown> | undefined) ?? {};
  const parsed = showResultsSchema.parse({
    filters: filtersSource,
    page_token: payload.page_token ?? null,
  });
  const { bars, nextToken } = await fetchBars(supabase, parsed.filters ?? {}, parsed.page_token ?? null);
  return buildInfoResponse('s_bar_results', {
    bars,
    q: parsed.filters?.q ?? null,
    area: parsed.filters?.area ?? null,
    page_token_next: nextToken,
  });
}

export async function handleBarDetail(payload: CustomerRequestPayload, supabase: SupabaseClient) {
  const parsed = barDetailSchema.parse({ bar_id: resolveField(payload, 'bar_id') });

  const { data, error } = await supabase
    .from('bars')
    .select('id, name, location_text, city_area, country, momo_code, bar_settings (allow_direct_customer_chat)')
    .eq('id', parsed.bar_id)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.bar_settings) {
    return buildErrorResponse('s_bar_results', 'This bar is unavailable.');
  }

  const location = [data.location_text, data.city_area, data.country].filter(Boolean).join(' · ');

  return buildInfoResponse('s_bar_detail', {
    bar_id: data.id,
    bar_name: data.name,
    location_text: location,
    momo_supported: data.momo_code ? 'Yes' : 'Contact bar',
    direct_chat_allowed: data.bar_settings.allow_direct_customer_chat,
  });
}

export async function handleCategories(payload: CustomerRequestPayload, supabase: SupabaseClient) {
  const parsed = categoriesSchema.parse({ bar_id: resolveField(payload, 'bar_id') });

  const { data: menuRow, error } = await supabase
    .from('menus')
    .select('id')
    .eq('bar_id', parsed.bar_id)
    .eq('status', 'published')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!menuRow) {
    return buildErrorResponse('s_bar_detail', 'Menu not available.');
  }

  const menuId = menuRow.id;

  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name, sort_order')
    .eq('menu_id', menuId)
    .eq('is_deleted', false)
    .is('parent_category_id', null)
    .order('sort_order', { ascending: true })
    .limit(CATEGORY_PAGE_SIZE);

  if (catError) throw catError;

  const { data: hasSubcategoriesRows } = await supabase
    .from('categories')
    .select('id')
    .eq('menu_id', menuId)
    .not('parent_category_id', 'is', null)
    .limit(1);

  return buildInfoResponse('s_categories', {
    bar_id: parsed.bar_id,
    menu_id: menuId,
    categories: categories?.map((cat) => ({
      id: cat.id,
      title: cat.name,
    })) ?? [],
    has_subcategories: Boolean(hasSubcategoriesRows && hasSubcategoriesRows.length > 0),
    subcategories: [],
  });
}

export async function handleItems(payload: CustomerRequestPayload, supabase: SupabaseClient) {
  const parsed = itemsSchema.parse({
    menu_id: resolveField(payload, 'menu_id'),
    category_id: resolveField(payload, 'category_id'),
    subcategory_id: resolveField(payload, 'subcategory_id'),
    page_token: payload.page_token ?? resolveField(payload, 'page_token') ?? null,
  });

  const query = supabase
    .from('items')
    .select('id, name, short_description, price_minor, currency, flags, is_available, sort_order')
    .eq('menu_id', parsed.menu_id)
    .order('sort_order', { ascending: true })
    .limit(ITEM_PAGE_SIZE + 1);

  if (parsed.category_id) {
    query.eq('category_id', parsed.category_id);
  }
  if (parsed.page_token) {
    query.gt('sort_order', Number(parsed.page_token));
  }

  const { data, error } = await query;
  if (error) throw error;

  const hasMore = data.length > ITEM_PAGE_SIZE;
  const slice = hasMore ? data.slice(0, ITEM_PAGE_SIZE) : data;
  const nextToken = hasMore ? String(slice[slice.length - 1]?.sort_order ?? '') : null;

  const items = slice.map((item) => ({
    id: item.id,
    title: `${item.name} — ${formatCurrency(item.price_minor, item.currency)}`,
    description: buildItemDescription(item.short_description, item.flags, item.is_available),
  }));

  return buildInfoResponse('s_items', {
    menu_id: parsed.menu_id,
    items,
    page_token_next: nextToken,
  });
}

export async function handleItemDetail(payload: CustomerRequestPayload, supabase: SupabaseClient) {
  const parsed = itemDetailSchema.parse({ item_id: resolveField(payload, 'item_id') });

  const { data, error } = await supabase
    .from('items')
    .select('id, name, short_description, price_minor, currency, flags, is_available, metadata')
    .eq('id', parsed.item_id)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return buildErrorResponse('s_items', 'Item not found.');
  }

  return buildInfoResponse('s_item_detail', {
    item_id: data.id,
    item_name: data.name,
    item_desc: data.short_description,
    price: formatCurrency(data.price_minor, data.currency ?? null),
    flags: data.flags,
    is_available: data.is_available,
    metadata: data.metadata ?? {},
  });
}

function formatCurrency(amountMinor: number, currency: string | null): string {
  if (!currency) return amountMinor.toString();
  const formatter = new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  });
  return formatter.format(amountMinor / 100);
}

function buildItemDescription(description: unknown, flags: unknown, available: boolean): string {
  const parts: string[] = [];
  if (typeof description === 'string' && description.trim().length) {
    parts.push(description.trim());
  }
  if (Array.isArray(flags) && flags.length) {
    parts.push(flags.join(', '));
  }
  if (!available) {
    parts.push('Unavailable');
  }
  return parts.join(' | ');
}

function formatBarDescription(cityArea: unknown, country: unknown) {
  const parts = [cityArea, country].filter((value) => typeof value === 'string' && value.length) as string[];
  return parts.join(' · ');
}
