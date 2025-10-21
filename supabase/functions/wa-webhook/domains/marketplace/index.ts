import type { RouterContext } from "../../types.ts";
import { clearState, setState } from "../../state/store.ts";
import {
  buildButtons,
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { createBusiness, listBusinesses } from "../../rpc/marketplace.ts";
import { t } from "../../i18n/translator.ts";
import { waChatLink } from "../../utils/links.ts";
import { sendHomeMenu } from "../../flows/home.ts";
import type { MarketplaceCategoryDef } from "./categories.ts";
import {
  buildCategoryRows,
  findCategoryById,
  getMarketplaceCategoryDefs,
  getMarketplaceCategoryLabel,
  normalizeMarketplaceCategoryInput,
} from "./categories.ts";

const MARKETPLACE_STATES = {
  MENU: "market_menu",
  CATEGORY: "market_category",
  ADD_NAME: "market_add_name",
  ADD_DESC: "market_add_desc",
  ADD_CATALOG: "market_add_catalog",
  ADD_LOCATION: "market_add_location",
  BROWSE_LOCATION: "market_browse_location",
  BROWSE_RESULTS: "market_browse_results",
} as const;

const ROW_PREFIX = "biz::";
const MAX_ROWS_PER_PAGE = 5;
const FETCH_LIMIT = 30;

type AddState = {
  name?: string;
  description?: string;
  catalog?: string;
  category?: string;
};

type MarketplaceEntry = {
  id: string;
  name: string;
  description?: string | null;
  owner_whatsapp: string;
  catalog_url?: string | null;
  distance_km?: number | null;
  location_text?: string | null;
  category?: string | null;
};

type BrowseState = {
  entries: MarketplaceEntry[];
  page: number;
  location: { lat: number; lng: number };
  category: string;
};

function makeRowId(id: string): string {
  return `${ROW_PREFIX}${id}`;
}

function parseRowId(id: string): string | null {
  if (!id.startsWith(ROW_PREFIX)) return null;
  return id.slice(ROW_PREFIX.length);
}

export async function startMarketplace(
  ctx: RouterContext,
  _state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: MARKETPLACE_STATES.MENU,
    data: {},
  });
  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "marketplace.menu.title"),
      body: t(ctx.locale, "marketplace.menu.body"),
      sectionTitle: t(ctx.locale, "common.actions"),
      rows: [
        {
          id: IDS.MARKETPLACE_BROWSE,
          title: t(ctx.locale, "marketplace.buttons.browse"),
          description: t(ctx.locale, "marketplace.desc.share_location"),
        },
        {
          id: IDS.MARKETPLACE_ADD,
          title: t(ctx.locale, "marketplace.buttons.add"),
          description: t(ctx.locale, "marketplace.desc.add_business"),
        },
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.home_button"),
          description: t(ctx.locale, "common.back_to_menu.description"),
        },
      ],
      buttonText: t(ctx.locale, "common.buttons.open"),
    },
    { emoji: "🛍️" },
  );
  return true;
}

export async function handleMarketplaceButton(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  id: string,
): Promise<boolean> {
  switch (id) {
    case IDS.MARKETPLACE_BROWSE:
      if (!ctx.profileId) return false;
      await setState(ctx.supabase, ctx.profileId, {
        key: MARKETPLACE_STATES.CATEGORY,
        data: {},
      });
      {
        const categoryDefs = await getMarketplaceCategoryDefs(ctx.supabase);
        const rows = [
          ...buildCategoryRows(categoryDefs),
          {
            id: IDS.MARKETPLACE_MENU,
            title: t(ctx.locale, "common.home_button"),
            description: t(ctx.locale, "marketplace.desc.back_menu"),
          },
        ];
        await sendListMessage(
          ctx,
          {
            title: t(ctx.locale, "marketplace.browse.title"),
            body: t(ctx.locale, "marketplace.browse.body"),
            sectionTitle: t(ctx.locale, "marketplace.browse.section"),
            rows,
            buttonText: t(ctx.locale, "common.buttons.choose"),
          },
          { emoji: "🛍️" },
        );
      }
      return true;
    case IDS.MARKETPLACE_ADD: {
      if (!ctx.profileId) return false;
      await setState(ctx.supabase, ctx.profileId, {
        key: MARKETPLACE_STATES.ADD_NAME,
        data: {},
      });
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "marketplace.prompts.enter_name"),
        buildButtons({
          id: IDS.MARKETPLACE_MENU,
          title: t(ctx.locale, "marketplace.buttons.back_menu"),
        }),
      );
      return true;
    }
    case IDS.MARKETPLACE_NEXT:
      return await changeBrowsePage(ctx, state, +1);
    case IDS.MARKETPLACE_PREV:
      return await changeBrowsePage(ctx, state, -1);
    case IDS.MARKETPLACE_REFRESH:
      if (await refreshBrowse(ctx, state)) return true;
      return await handleMarketplaceButton(ctx, state, IDS.MARKETPLACE_BROWSE);
    case IDS.MARKETPLACE_SKIP:
      return await handleMarketplaceSkip(ctx, state);
    case IDS.MARKETPLACE_MENU:
      return await startMarketplace(ctx, state);
    case IDS.BACK_MENU:
      await clearState(ctx.supabase, ctx.profileId);
      await sendHomeMenu(ctx);
      return true;
    default:
      return false;
  }
}

export async function handleMarketplaceText(
  ctx: RouterContext,
  body: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const trimmed = body.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase() === "menu") {
    await startMarketplace(ctx, state);
    return true;
  }
  if (trimmed.toLowerCase() === "browse") {
    return await handleMarketplaceButton(ctx, state, IDS.MARKETPLACE_BROWSE);
  }
  if (trimmed.toLowerCase() === "add") {
    return await handleMarketplaceButton(ctx, state, IDS.MARKETPLACE_ADD);
  }
  if (trimmed.toLowerCase() === "skip") {
    return await handleMarketplaceSkip(ctx, state);
  }
  switch (state.key) {
    case MARKETPLACE_STATES.CATEGORY:
      return await selectCategory(ctx, body);
    case MARKETPLACE_STATES.ADD_NAME:
      return await captureBusinessName(ctx, state, trimmed);
    case MARKETPLACE_STATES.ADD_DESC:
      return await captureBusinessDescription(ctx, state, trimmed);
    case MARKETPLACE_STATES.ADD_CATALOG:
      return await captureBusinessCatalog(ctx, state, trimmed);
    default:
      return false;
  }
}

export async function handleMarketplaceLocation(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (state.key === MARKETPLACE_STATES.ADD_LOCATION) {
    const addState = (state.data ?? {}) as AddState;
    const name = (addState.name ?? "").trim();
    if (!name) {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "marketplace.errors.name_missing"),
        buildButtons({
          id: IDS.MARKETPLACE_MENU,
          title: t(ctx.locale, "marketplace.buttons.back_menu"),
        }),
      );
      await clearState(ctx.supabase, ctx.profileId);
      await startMarketplace(ctx, state);
      return true;
    }
    try {
      await createBusiness(ctx.supabase, {
        owner: ctx.from,
        name: name.slice(0, 60),
        description: addState.description ?? undefined,
        catalog_url: addState.catalog ?? undefined,
        category: addState.category ?? null,
        lat: coords.lat,
        lng: coords.lng,
      });
      await clearState(ctx.supabase, ctx.profileId);
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "marketplace.status.published"),
        buildButtons(
          {
            id: IDS.MARKETPLACE_ADD,
            title: t(ctx.locale, "marketplace.buttons.add_another"),
          },
          {
            id: IDS.MARKETPLACE_BROWSE,
            title: t(ctx.locale, "marketplace.buttons.browse_nearby"),
          },
        ),
      );
    } catch (error) {
      console.error("marketplace.create_fail", error);
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "marketplace.errors.save_fail"),
        buildButtons(
          {
            id: IDS.MARKETPLACE_ADD,
            title: t(ctx.locale, "common.buttons.retry"),
          },
          {
            id: IDS.MARKETPLACE_MENU,
            title: t(ctx.locale, "marketplace.buttons.back_menu"),
          },
        ),
      );
    }
    return true;
  }
  if (state.key === MARKETPLACE_STATES.BROWSE_LOCATION) {
    const category = typeof state.data?.category === "string"
      ? state.data.category
      : "other";
    return await fetchAndShowBusinesses(ctx, coords, category, 0);
  }
  return false;
}

export async function handleMarketplaceResult(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  id: string,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== MARKETPLACE_STATES.BROWSE_RESULTS) {
    return false;
  }
  const browse = state.data as BrowseState | undefined;
  if (!browse) return false;
  const businessId = parseRowId(id);
  if (!businessId) return false;
  const entry = browse.entries.find((item) => item.id === businessId);
  if (!entry) return false;
  await sendBusinessDetail(ctx, entry);
  return true;
}

// Helpers ------------------------------------------------------------------

async function captureBusinessName(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  value: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (value.length < 2) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Name must be at least 2 characters. Please resend your business name.",
      buildButtons({ id: IDS.MARKETPLACE_MENU, title: "↩️ Back" }),
    );
    return true;
  }
  const name = value.slice(0, 60);
  await setState(ctx.supabase, ctx.profileId, {
    key: MARKETPLACE_STATES.ADD_DESC,
    data: { ...(state.data ?? {}), name },
  });
  await sendButtonsMessage(
    ctx,
    "📝 Optional: send a short description (or tap Skip).",
    buildButtons({ id: IDS.MARKETPLACE_SKIP, title: "Skip" }),
  );
  return true;
}

async function captureBusinessDescription(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  value: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: MARKETPLACE_STATES.ADD_CATALOG,
    data: { ...(state.data ?? {}), description: value.slice(0, 140) },
  });
  await sendButtonsMessage(
    ctx,
    "🔗 Optional: send your WhatsApp Catalog URL (or tap Skip).",
    buildButtons({ id: IDS.MARKETPLACE_SKIP, title: "Skip" }),
  );
  return true;
}

async function captureBusinessCatalog(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  value: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: MARKETPLACE_STATES.ADD_LOCATION,
    data: { ...(state.data ?? {}), catalog: value.trim() },
  });
  await sendButtonsMessage(
    ctx,
    "📍 Share your shop location (tap ➕ → Location → Share).",
    [],
  );
  return true;
}

async function handleMarketplaceSkip(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  switch (state.key) {
    case MARKETPLACE_STATES.ADD_DESC:
      await setState(ctx.supabase, ctx.profileId, {
        key: MARKETPLACE_STATES.ADD_CATALOG,
        data: state.data ?? {},
      });
      await sendButtonsMessage(
        ctx,
        "🔗 Optional: send your WhatsApp Catalog URL (or tap Skip).",
        buildButtons({ id: IDS.MARKETPLACE_SKIP, title: "Skip" }),
      );
      return true;
    case MARKETPLACE_STATES.ADD_CATALOG:
      await setState(ctx.supabase, ctx.profileId, {
        key: MARKETPLACE_STATES.ADD_LOCATION,
        data: state.data ?? {},
      });
      await sendButtonsMessage(
        ctx,
        "📍 Share your shop location (tap ➕ → Location → Share).",
        [],
      );
      return true;
    default:
      return false;
  }
}

async function fetchAndShowBusinesses(
  ctx: RouterContext,
  coords: { lat: number; lng: number },
  category: string,
  page: number,
): Promise<boolean> {
  let entries: any[] = [];
  try {
    entries = await listBusinesses(ctx.supabase, coords, category, FETCH_LIMIT);
  } catch (error) {
    console.error("marketplace.list_fail", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Could not fetch nearby businesses right now.",
      buildButtons(
        { id: IDS.MARKETPLACE_REFRESH, title: "🔄 Retry" },
        { id: IDS.MARKETPLACE_ADD, title: "➕ Add business" },
      ),
    );
    return true;
  }
  const normalized = entries.map((entry: any) => {
    const categorySlug = (() => {
      if (
        typeof entry.category_slug === "string" &&
        entry.category_slug.length > 0
      ) {
        return entry.category_slug;
      }
      if (typeof entry.category === "string" && entry.category.length > 0) {
        return entry.category;
      }
      return null;
    })();
    return {
      id: entry.id,
      name: entry.name ?? "Business",
      description: entry.description ?? null,
      owner_whatsapp: entry.owner_whatsapp ?? ctx.from,
      catalog_url: entry.catalog_url ?? null,
      distance_km: entry.distance_km ?? null,
      location_text: entry.location_text ?? entry.city_area ?? entry.country ??
        null,
      category: categorySlug,
    };
  });
  return await renderBrowsePage(ctx, {
    entries: normalized,
    page,
    location: coords,
    category,
  });
}

async function changeBrowsePage(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  delta: number,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== MARKETPLACE_STATES.BROWSE_RESULTS) {
    return false;
  }
  const browse = state.data as BrowseState | undefined;
  if (!browse) return false;
  const nextPage = Math.max(browse.page + delta, 0);
  return await renderBrowsePage(ctx, {
    ...browse,
    page: nextPage,
  });
}

async function refreshBrowse(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId || state.key !== MARKETPLACE_STATES.BROWSE_RESULTS) {
    return false;
  }
  const browse = state.data as BrowseState | undefined;
  if (!browse) return false;
  return await fetchAndShowBusinesses(
    ctx,
    browse.location,
    browse.category,
    browse.page,
  );
}

async function renderBrowsePage(
  ctx: RouterContext,
  browse: BrowseState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const categoryDefs = await getMarketplaceCategoryDefs(ctx.supabase);
  const pageInfo = paginateEntries(browse.entries, browse.page);
  if (!pageInfo.items.length) {
    await setState(ctx.supabase, ctx.profileId, {
      key: MARKETPLACE_STATES.BROWSE_LOCATION,
      data: { category: browse.category },
    });
    const categoryLabel = getMarketplaceCategoryLabel(
      categoryDefs,
      browse.category,
    );
    await sendListMessage(
      ctx,
      {
        title: "🛍️ Nearby businesses",
        body: `No ${categoryLabel} found nearby yet.`,
        sectionTitle: "Actions",
        rows: [
          {
            id: IDS.MARKETPLACE_REFRESH,
            title: "🔄 Refresh list",
            description: "Reload nearby businesses.",
          },
          {
            id: IDS.MARKETPLACE_ADD,
            title: "➕ Add business",
            description: "Publish your shop for others to see.",
          },
          {
            id: IDS.MARKETPLACE_MENU,
            title: "← Back",
            description: "Return to the marketplace menu.",
          },
        ],
        buttonText: "Select",
      },
      { emoji: "🛍️" },
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: MARKETPLACE_STATES.BROWSE_RESULTS,
    data: {
      ...browse,
      page: pageInfo.page,
    },
  });
  const categoryLabel = getMarketplaceCategoryLabel(
    categoryDefs,
    browse.category,
  );
  const rangeText = `${(pageInfo.page * MAX_ROWS_PER_PAGE) + 1}-${
    Math.min((pageInfo.page + 1) * MAX_ROWS_PER_PAGE, browse.entries.length)
  } of ${browse.entries.length}`;
  const body = `${categoryLabel} • Showing ${rangeText}.`;

  const businessRows = pageInfo.items.map((entry) => ({
    id: makeRowId(entry.id),
    title: formatListTitle(entry),
    description: formatListDescription(entry, categoryDefs),
  }));

  const rows: Array<{ id: string; title: string; description?: string }> = [
    ...businessRows,
  ];
  if (pageInfo.hasPrev) {
    rows.push({
      id: IDS.MARKETPLACE_PREV,
      title: "◀️ Previous page",
      description: "See the earlier results.",
    });
  }
  if (pageInfo.hasNext) {
    rows.push({
      id: IDS.MARKETPLACE_NEXT,
      title: "▶️ More results",
      description: "Show the next set of sellers.",
    });
  }
  rows.push({
    id: IDS.MARKETPLACE_REFRESH,
    title: "🔄 Refresh list",
    description: "Reload nearby businesses.",
  });
  rows.push({
    id: IDS.MARKETPLACE_ADD,
    title: "➕ Add business",
    description: "Publish your shop for others to see.",
  });
  rows.push({
    id: IDS.MARKETPLACE_MENU,
    title: "← Back",
    description: "Return to the marketplace menu.",
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "marketplace.results.nearby_title"),
      body,
      sectionTitle: t(ctx.locale, "marketplace.results.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.open"),
    },
    { emoji: "🛍️" },
  );
  return true;
}

function paginateEntries(entries: MarketplaceEntry[], page: number) {
  if (!entries.length) {
    return { items: [], hasPrev: false, hasNext: false, page: 0 };
  }
  const totalPages = Math.max(
    Math.ceil(entries.length / MAX_ROWS_PER_PAGE),
    1,
  );
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = safePage * MAX_ROWS_PER_PAGE;
  const slice = entries.slice(start, start + MAX_ROWS_PER_PAGE);
  return {
    items: slice,
    hasPrev: safePage > 0,
    hasNext: safePage < totalPages - 1,
    page: safePage,
  };
}

function formatListTitle(entry: MarketplaceEntry): string {
  return entry.name.length > 40 ? `${entry.name.slice(0, 37)}…` : entry.name;
}

function formatListDescription(
  entry: MarketplaceEntry,
  categoryDefs: MarketplaceCategoryDef[],
): string | undefined {
  const parts: string[] = [];
  if (entry.category) {
    parts.push(getMarketplaceCategoryLabel(categoryDefs, entry.category));
  }
  if (entry.distance_km != null) {
    const km = Number(entry.distance_km);
    if (Number.isFinite(km)) {
      parts.push(
        km >= 1
          ? t(ctx.locale, "marketplace.row.distance_km", { km: km.toFixed(1) })
          : t(ctx.locale, "marketplace.row.distance_m", {
            m: String(Math.round(km * 1000)),
          }),
      );
    }
  }
  if (entry.location_text) parts.push(entry.location_text);
  if (entry.description) parts.push(entry.description.slice(0, 40));
  return parts.length ? parts.join(" • ") : undefined;
}

async function sendBusinessDetail(
  ctx: RouterContext,
  entry: MarketplaceEntry,
): Promise<void> {
  const lines = [
    `🛍️ *${entry.name}*`,
  ];
  if (entry.category) {
    const categoryDefs = await getMarketplaceCategoryDefs(ctx.supabase);
    const label = getMarketplaceCategoryLabel(categoryDefs, entry.category);
    lines.push(`#${label}`);
  }
  if (entry.location_text) lines.push(`📍 ${entry.location_text}`);
  if (entry.description) lines.push(entry.description);
  const waLink = waChatLink(
    entry.owner_whatsapp,
    t(ctx.locale, "marketplace.detail.chat_prefill"),
  );
  lines.push(`💬 Chat: ${waLink}`);
  if (entry.catalog_url) {
    lines.push(
      t(ctx.locale, "marketplace.detail.catalog", { url: entry.catalog_url }),
    );
  }
  lines.push(t(ctx.locale, "marketplace.detail.tip_save_contact"));

  await sendButtonsMessage(
    ctx,
    lines.join("\n"),
    buildButtons(
      {
        id: IDS.MARKETPLACE_REFRESH,
        title: t(ctx.locale, "marketplace.buttons.more_nearby"),
      },
      {
        id: IDS.MARKETPLACE_ADD,
        title: t(ctx.locale, "marketplace.buttons.add"),
      },
    ),
  );
}

async function selectCategory(
  ctx: RouterContext,
  input: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const categoryDefs = await getMarketplaceCategoryDefs(ctx.supabase);
  const normalized = normalizeMarketplaceCategoryInput(categoryDefs, input);
  if (normalized === "home") {
    await sendHomeMenu(ctx);
    return true;
  }
  if (!normalized) {
    await showCategoryList(ctx);
    return true;
  }
  return await applyCategory(ctx, normalized);
}

export async function handleMarketplaceCategorySelection(
  ctx: RouterContext,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (id === IDS.BACK_HOME) {
    await sendHomeMenu(ctx);
    return true;
  }
  const categoryDefs = await getMarketplaceCategoryDefs(ctx.supabase);
  const match = findCategoryById(categoryDefs, id);
  if (!match) {
    await showCategoryList(ctx);
    return true;
  }
  return await applyCategory(ctx, match.value);
}

async function applyCategory(
  ctx: RouterContext,
  category: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: MARKETPLACE_STATES.BROWSE_LOCATION,
    data: { category },
  });
  await sendButtonsMessage(
    ctx,
    "📍 Share your location (tap ➕ → Location → Share live) to see sellers nearby.",
    [],
  );
  return true;
}

async function showCategoryList(ctx: RouterContext): Promise<void> {
  const categoryDefs = await getMarketplaceCategoryDefs(ctx.supabase);
  const rows = [
    ...buildCategoryRows(categoryDefs),
    { id: IDS.BACK_HOME, title: "🏠 Home" },
  ];
  await sendListMessage(
    ctx,
    {
      title: "🛍️ Browse marketplace",
      body: "Pick a business type to continue.",
      sectionTitle: "Categories",
      rows,
      buttonText: "Choose",
    },
    { emoji: "🛍️" },
  );
}
