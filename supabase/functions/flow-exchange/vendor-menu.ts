import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { buildInfoResponse, buildErrorResponse } from './utils.ts';
import type { SupabaseClient } from './types.ts';

const basePayloadSchema = z.object({
  bar_id: z.string().uuid(),
});

const categoryActionSchema = basePayloadSchema.extend({
  category_id: z.string().uuid().optional(),
  direction: z.enum(['up', 'down']).optional(),
  name: z.string().min(2).max(60).optional(),
  parent_category_id: z.string().uuid().optional().nullable(),
});

const itemActionSchema = basePayloadSchema.extend({
  category_id: z.string().uuid().optional(),
  item_id: z.string().uuid().optional(),
  name: z.string().min(2).max(80).optional(),
  short_desc: z.string().max(160).optional().nullable(),
  price: z.coerce.number().positive().optional(),
  flags: z.array(z.string()).optional(),
  available: z.string().optional(),
  mode: z.enum(['increase', 'decrease', 'set_exact']).optional(),
  amount_type: z.enum(['currency', 'percent']).optional(),
  amount_value: z.coerce.number().positive().optional(),
});

type Payload = Record<string, unknown>;

function resolveField(payload: Payload, key: string) {
  if (key in payload && payload[key] !== undefined) return payload[key];
  const fields = (payload.fields as Record<string, unknown> | null) ?? undefined;
  const context = (payload.context as Record<string, unknown> | null) ?? undefined;
  if (fields && key in fields) return fields[key];
  if (context && key in context) return context[key];
  return undefined;
}

export async function handleCategoryList(payload: Payload, supabase: SupabaseClient) {
  const parsed = basePayloadSchema.parse({
    bar_id: resolveField(payload, 'bar_id'),
  });

  const { data: menu } = await supabase
    .from('menus')
    .select('id, status')
    .eq('bar_id', parsed.bar_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!menu) {
    return buildErrorResponse('s_cat_tree', 'No menu found.');
  }

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name, sort_order')
    .eq('menu_id', menu.id)
    .eq('is_deleted', false)
    .is('parent_category_id', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;

  return buildInfoResponse('s_cat_tree', {
    bar_id: parsed.bar_id,
    menu_id: menu.id,
    categories: (categories ?? []).map((cat) => ({ id: cat.id, title: cat.name })),
  });
}

export async function handleCategoryMove(payload: Payload, supabase: SupabaseClient) {
  const parsed = categoryActionSchema.parse({
    bar_id: resolveField(payload, 'bar_id'),
    category_id: resolveField(payload, 'category_id'),
    direction: resolveField(payload, 'direction'),
  });

  const { data: category, error } = await supabase
    .from('categories')
    .select('id, menu_id, sort_order')
    .eq('id', parsed.category_id)
    .maybeSingle();
  if (error) throw error;
  if (!category) {
    return buildErrorResponse('s_cat_tree', 'Category not found.');
  }

  const delta = parsed.direction === 'up' ? -1 : 1;
  const newOrder = (category.sort_order ?? 0) + delta;
  await supabase
    .from('categories')
    .update({ sort_order: newOrder })
    .eq('id', category.id);

  return handleCategoryList(payload, supabase);
}

export async function handleCategoryRename(payload: Payload, supabase: SupabaseClient) {
  const parsed = categoryActionSchema.parse({
    bar_id: resolveField(payload, 'bar_id'),
    category_id: resolveField(payload, 'category_id'),
    name: resolveField(payload, 'new_name') ?? resolveField(payload, 'name'),
  });

  await supabase
    .from('categories')
    .update({ name: parsed.name })
    .eq('id', parsed.category_id);

  return handleCategoryList(payload, supabase);
}

export async function handleCategoryAdd(payload: Payload, supabase: SupabaseClient) {
  const parsed = categoryActionSchema.parse({
    bar_id: resolveField(payload, 'bar_id'),
    parent_category_id: resolveField(payload, 'parent_category_id'),
    name: resolveField(payload, 'name'),
  });

  const { data: menu } = await supabase
    .from('menus')
    .select('id')
    .eq('bar_id', parsed.bar_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!menu) {
    return buildErrorResponse('s_cat_tree', 'No menu available.');
  }

  await supabase.from('categories').insert({
    bar_id: parsed.bar_id,
    menu_id: menu.id,
    parent_category_id: parsed.parent_category_id ?? null,
    name: parsed.name,
  });

  return handleCategoryList(payload, supabase);
}

export async function handleItemsList(payload: Payload, supabase: SupabaseClient) {
  const parsed = itemActionSchema.parse({
    bar_id: resolveField(payload, 'bar_id'),
    category_id: resolveField(payload, 'category_id'),
  });

  const { data: menu } = await supabase
    .from('menus')
    .select('id')
    .eq('bar_id', parsed.bar_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!menu) {
    return buildErrorResponse('s_items_list', 'Menu missing.');
  }

  const { data: items, error } = await supabase
    .from('items')
    .select('id, name, price_minor, currency, is_available')
    .eq('menu_id', menu.id)
    .eq('category_id', parsed.category_id)
    .order('sort_order', { ascending: true });
  if (error) throw error;

  return buildInfoResponse('s_items_list', {
    bar_id: parsed.bar_id,
    menu_id: menu.id,
    category_id: parsed.category_id,
    items: (items ?? []).map((item) => ({
      id: item.id,
      title: `${item.name} — ${formatCurrency(item.price_minor, item.currency)}`,
      description: item.is_available ? 'Available' : 'Unavailable',
    })),
  });
}

export async function handleItemToggle(payload: Payload, supabase: SupabaseClient) {
  const parsed = itemActionSchema.parse({
    bar_id: resolveField(payload, 'bar_id'),
    item_id: resolveField(payload, 'item_id'),
  });
  const { data: item } = await supabase
    .from('items')
    .select('id, is_available')
    .eq('id', parsed.item_id)
    .maybeSingle();
  if (!item) {
    return buildErrorResponse('s_items_list', 'Item not found.');
  }

  await supabase
    .from('items')
    .update({ is_available: !item.is_available })
    .eq('id', parsed.item_id);

  return handleItemsList(payload, supabase);
}

export async function handleItemSave(payload: Payload, supabase: SupabaseClient) {
  const parsed = itemActionSchema.parse({
    bar_id: resolveField(payload, 'bar_id'),
    item_id: resolveField(payload, 'item_id'),
    name: resolveField(payload, 'name'),
    short_desc: resolveField(payload, 'short_desc'),
    price: resolveField(payload, 'price'),
    flags: resolveField(payload, 'flags'),
    available: resolveField(payload, 'available'),
  });

  await supabase
    .from('items')
    .update({
      name: parsed.name,
      short_description: parsed.short_desc ?? null,
      price_minor: parsed.price ? Math.round(parsed.price * 100) : undefined,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      is_available: parsed.available === 'true',
    })
    .eq('id', parsed.item_id);

  return handleItemsList(payload, supabase);
}

export async function handleItemCreate(payload: Payload, supabase: SupabaseClient) {
  const parsed = itemActionSchema.parse({
    bar_id: resolveField(payload, 'bar_id'),
    category_id: resolveField(payload, 'category_id'),
    name: resolveField(payload, 'name'),
    short_desc: resolveField(payload, 'short_desc'),
    price: resolveField(payload, 'price'),
    flags: resolveField(payload, 'flags'),
  });

  const { data: menu } = await supabase
    .from('menus')
    .select('id, bar_id')
    .eq('bar_id', parsed.bar_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!menu) throw new Error('Menu not found');

  await supabase.from('items').insert({
    bar_id: parsed.bar_id,
    menu_id: menu.id,
    category_id: parsed.category_id ?? null,
    name: parsed.name,
    short_description: parsed.short_desc ?? null,
    price_minor: parsed.price ? Math.round(parsed.price * 100) : 0,
    flags: Array.isArray(parsed.flags) ? parsed.flags : [],
    is_available: true,
  });

  return handleItemsList(payload, supabase);
}

export async function handleBulkPrices(payload: Payload, supabase: SupabaseClient) {
  const parsed = itemActionSchema.parse({
    bar_id: resolveField(payload, 'bar_id'),
    category_id: resolveField(payload, 'category_id'),
    mode: resolveField(payload, 'mode'),
    amount_type: resolveField(payload, 'amount_type'),
    amount_value: resolveField(payload, 'amount_value'),
  });

  if (!parsed.mode || !parsed.amount_type || parsed.amount_value === undefined) {
    return buildErrorResponse('s_items_list', 'Provide mode, amount type, and value.');
  }

  const { data: items } = await supabase
    .from('items')
    .select('id, price_minor')
    .eq('bar_id', parsed.bar_id)
    .eq('category_id', parsed.category_id ?? null);

  if (!items?.length) {
    return buildErrorResponse('s_items_list', 'No items to update.');
  }

  const updates = items.map((item) => ({
    id: item.id,
    price_minor: computeBulkPrice(item.price_minor ?? 0, parsed.mode!, parsed.amount_type!, parsed.amount_value!),
  }));

  for (const update of updates) {
    await supabase.from('items').update({ price_minor: update.price_minor }).eq('id', update.id);
  }

  return handleItemsList(payload, supabase);
}

function computeBulkPrice(current: number, mode: string, amountType: string, amountValue: number) {
  if (mode === 'set_exact' && amountType === 'currency') {
    return Math.max(0, Math.round(amountValue * 100));
  }
  if (amountType === 'currency') {
    const delta = Math.round(amountValue * 100);
    const next = mode === 'increase' ? current + delta : current - delta;
    return Math.max(0, next);
  }
  const factor = amountValue / 100;
  const next =
    mode === 'increase'
      ? Math.round(current * (1 + factor))
      : mode === 'decrease'
      ? Math.round(current * (1 - factor))
      : Math.round(amountValue * 100);
  return Math.max(0, next);
}

function formatCurrency(amountMinor: number, currency: string | null | undefined) {
  if (!currency) {
    return `RWF ${(amountMinor / 100).toFixed(2)}`;
  }
  const formatter = new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  });
  return formatter.format(amountMinor / 100);
}
