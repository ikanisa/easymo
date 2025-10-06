import type { RouterContext } from "../../types.ts";
import { setState } from "../../state/store.ts";
import { sendListMessage } from "../../utils/reply.ts";
import { queueNotification } from "../../services/notifications/queue.ts";
import { DINE_IDS, makeItemRowId, makeMoreRowId } from "./ids.ts";
import { clampOffset, formatPrice, logFlowAction, truncate } from "./utils.ts";
import { copy } from "./copy.ts";

const ITEMS_PER_PAGE = 9;
const LIST_FETCH_SIZE = ITEMS_PER_PAGE + 1;
const MENU_EMOJI = "🍽️";

type ChatState = { key: string; data?: Record<string, unknown> };
type OffsetOptions = { offset?: number };

type MenuContext = {
  id: string;
  totalItems: number;
};

type ItemRecord = {
  rawId: string;
  name: string;
  shortDescription: string | null;
  priceMinor: number;
  currency: string | null;
  categoryName: string | null;
};

type ItemPage = {
  items: ItemRecord[];
  nextOffset: number | null;
  prevOffset: number | null;
};

type ItemListState = {
  bar_id: string;
  bar_name: string;
  bar_slug?: string | null;
  menu_id: string;
  offset: number;
  total_count: number;
  item_ids: string[];
  next_offset: number | null;
  prev_offset: number | null;
  can_manage?: boolean;
};

export async function openMenu(
  ctx: RouterContext,
  state: ChatState,
  options: OffsetOptions = {},
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const barId = resolveBarId(state);
  if (!barId) {
    await sendListMessage(
      ctx,
      {
        title: copy("bars.list.title"),
        body: copy("cart.chooseBar"),
        sectionTitle: "Bars",
        buttonText: "Select",
        rows: [],
      },
      { emoji: MENU_EMOJI },
    );
    return false;
  }

  await logFlowAction(ctx, "open_menu", state.key, { bar_id: barId });

  try {
    const context = await fetchMenuContext(ctx, barId);
    if (!context) {
      await sendListMessage(
        ctx,
        {
          title: copy("menu.items.title", {
            bar: state.data?.bar_name as string ?? "Menu",
          }),
          body: copy("menu.unavailable"),
          sectionTitle: "Menu",
          buttonText: "OK",
          rows: [],
        },
        { emoji: MENU_EMOJI },
      );
      return true;
    }

    if (!context.totalItems) {
      await sendListMessage(
        ctx,
        {
          title: copy("menu.items.title", {
            bar: state.data?.bar_name as string ?? "Menu",
          }),
          body: copy("menu.items.none"),
          sectionTitle: "Menu",
          buttonText: "OK",
          rows: [],
        },
        { emoji: MENU_EMOJI },
      );
      return true;
    }

    const requestedOffset = options.offset ?? Number(state.data?.offset ?? 0);
    const offset = clampOffset(
      context.totalItems,
      requestedOffset,
      ITEMS_PER_PAGE,
    );
    const page = await fetchMenuItems(ctx, context.id, offset);

    if (!page.items.length && offset > 0) {
      return await openMenu(ctx, state, { offset: 0 });
    }

    const barName = typeof state.data?.bar_name === "string"
      ? state.data.bar_name
      : "Menu";

    const barSlug = typeof state.data?.bar_slug === "string"
      ? state.data.bar_slug
      : null;

    await setState(ctx.supabase, ctx.profileId, {
      key: "dine_items",
      data: {
        bar_id: barId,
        bar_name: barName,
        bar_slug: barSlug,
        menu_id: context.id,
        offset,
        total_count: context.totalItems,
        item_ids: page.items.map((item) => item.rawId),
        next_offset: page.nextOffset,
        prev_offset: page.prevOffset,
        can_manage: Boolean(state.data?.can_manage),
      } satisfies ItemListState,
    });

    const rows = page.items.map((item) => ({
      id: makeItemRowId(item.rawId),
      title: truncate(item.name, 60),
      description: buildItemDescription(item),
    }));

    if (page.nextOffset !== null) {
      rows.push({
        id: makeMoreRowId(page.nextOffset),
        title: "More dishes ▶️",
        description: copy("menu.more.tip"),
      });
    }

    await sendListMessage(
      ctx,
      {
        title: copy("menu.items.title", { bar: barName }),
        body: copy("menu.items.body"),
        sectionTitle: "Menu",
        buttonText: "Select",
        rows,
      },
      { emoji: MENU_EMOJI },
    );
    return true;
  } catch (err) {
    await logFlowAction(ctx, "open_menu_error", state.key, {
      bar_id: barId,
      message: err instanceof Error ? err.message : String(err),
    });
    await sendListMessage(
      ctx,
      {
        title: copy("menu.items.title", {
          bar: state.data?.bar_name as string ?? "Menu",
        }),
        body: copy("error.retry"),
        sectionTitle: "Menu",
        buttonText: "OK",
        rows: [],
      },
      { emoji: MENU_EMOJI },
    );
    return true;
  }
}

export async function handleItemsPagingButton(
  ctx: RouterContext,
  id: string,
  state: ChatState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const data = (state.data ?? {}) as Partial<ItemListState>;
  const nextOffset = typeof data.next_offset === "number"
    ? data.next_offset
    : null;
  const prevOffset = typeof data.prev_offset === "number"
    ? data.prev_offset
    : null;

  if (id === DINE_IDS.ITEMS_NEXT && nextOffset !== null) {
    return await openMenu(ctx, state, { offset: nextOffset });
  }
  if (id === DINE_IDS.ITEMS_PREV && prevOffset !== null) {
    return await openMenu(ctx, state, { offset: prevOffset });
  }

  return false;
}

export function resolveBarId(state: ChatState): string | null {
  const barId = state.data?.bar_id;
  if (typeof barId === "string" && barId.length) return barId;
  return null;
}

async function fetchMenuContext(
  ctx: RouterContext,
  barId: string,
): Promise<MenuContext | null> {
  const { data, error } = await ctx.supabase
    .from("menus")
    .select("id")
    .eq("bar_id", barId)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1);
  if (error && error.code !== "PGRST116") throw error;
  if (!data?.length) return null;
  const menuId = data[0].id;
  const { count, error: countError } = await ctx.supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("menu_id", menuId)
    .eq("is_available", true);
  if (countError && countError.code !== "PGRST116") throw countError;
  return { id: menuId, totalItems: count ?? 0 };
}

async function fetchMenuItems(
  ctx: RouterContext,
  menuId: string,
  offset: number,
): Promise<ItemPage> {
  const rangeEnd = offset + LIST_FETCH_SIZE - 1;
  const { data, error } = await ctx.supabase
    .from("items")
    .select(
      "id, name, short_description, price_minor, currency, categories(name)",
    )
    .eq("menu_id", menuId)
    .eq("is_available", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .range(offset, rangeEnd);
  if (error) throw error;
  const rows = (data ?? []).map((row: any) => ({
    rawId: row.id,
    name: row.name,
    shortDescription: row.short_description,
    priceMinor: row.price_minor,
    currency: row.currency,
    categoryName: row.categories?.name ?? null,
  }));
  const display = rows.slice(0, ITEMS_PER_PAGE);
  const hasNext = rows.length > ITEMS_PER_PAGE;
  return {
    items: display,
    nextOffset: hasNext ? offset + ITEMS_PER_PAGE : null,
    prevOffset: offset > 0 ? Math.max(offset - ITEMS_PER_PAGE, 0) : null,
  };
}

function buildItemDescription(item: ItemRecord): string {
  const price = formatPrice(item.priceMinor, item.currency ?? undefined);
  const parts: string[] = [price];
  if (item.categoryName) parts.push(truncate(item.categoryName, 32));
  if (item.shortDescription) parts.push(truncate(item.shortDescription, 60));
  return parts.join(" • ");
}
