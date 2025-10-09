import type { RouterContext } from "../../types.ts";
import { setState } from "../../state/store.ts";
import {
  homeOnly,
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";
import { DINE_IDS, isBarRow, makeBarRowId, parseBarId } from "./ids.ts";
import { IDS } from "../../wa/ids.ts";
import { clampOffset, logFlowAction, truncate } from "./utils.ts";
import { copy } from "./copy.ts";
import {
  type BarProfile,
  fetchBarProfile,
  fetchBarProfileBySlug,
} from "./service.ts";
import { CAMELLIA_MANAGER_E164 } from "./constants.ts";
import { ensureSession } from "../../exchange/helpers.ts";
import { sendFlowMessage, sendImageUrl } from "../../wa/client.ts";
import { WA_BOT_NUMBER_E164 } from "../../config.ts";

const PAGE_SIZE = 10;
const BROWSE_EMOJI = "🍹";
const ERROR_EMOJI = "⚠️";
const MANAGER_EMOJI = "🛠️";
const QR_EMOJI = "🔖";

export function buildMenuDeeplink(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  const digits = WA_BOT_NUMBER_E164.replace(/[^0-9]/g, "");
  const message = encodeURIComponent(`menu ${normalized}`);
  const base = digits.length ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${message}`;
}

function stateBarSlug(state: ChatState): string | null {
  const slug = state.data?.bar_slug;
  if (typeof slug === "string" && slug.length) return slug.toLowerCase();
  return null;
}

function stateBarName(state: ChatState): string | null {
  const name = state.data?.bar_name;
  return typeof name === "string" && name.length ? name : null;
}

type ChatState = { key: string; data?: Record<string, unknown> };
type StartOptions = { skipResume?: boolean; offset?: number };

type BarListItem = {
  rawId: string;
  slug: string;
  title: string;
  description: string;
};

type BarListResult = {
  items: BarListItem[];
  nextOffset: number | null;
  prevOffset: number | null;
};

export async function startDineIn(
  ctx: RouterContext,
  state: ChatState,
  options: StartOptions = {},
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const stateKey = state?.key ?? "unknown";
  await logFlowAction(ctx, "start_dine_in", stateKey, {
    skip_resume: Boolean(options.skipResume),
  });
  try {
    if (!options.skipResume) {
      const priorBarId = resolveBarId(state);
      if (priorBarId) {
        const profile = await fetchBarProfile(ctx.supabase, priorBarId);
        if (profile) {
          await presentBarMenu(ctx, profile, { resume: true });
          return true;
        }
      }
    }
    const total = await countActiveBars(ctx);
    const offset = clampOffset(
      total,
      options.offset ?? Number(state.data?.offset ?? 0),
      PAGE_SIZE,
    );
    await sendBarList(ctx, offset);
    return true;
  } catch (err) {
    await logFlowAction(ctx, "start_dine_in_error", stateKey, {
      message: err instanceof Error ? err.message : String(err),
    });
    await sendButtonsMessage(
      ctx,
      copy("error.retry"),
      homeOnly(),
      { emoji: ERROR_EMOJI },
    );
    return true;
  }
}

export async function sendBarList(
  ctx: RouterContext,
  offset: number,
): Promise<void> {
  if (!ctx.profileId) return;
  await logFlowAction(ctx, "bars_list", "dine_bars", { offset });
  try {
    const result = await fetchBars(ctx, offset);
    if (!result.items.length && offset > 0) {
      await sendBarList(ctx, 0);
      return;
    }
    if (!result.items.length) {
      await sendButtonsMessage(
        ctx,
        copy("bars.none"),
        homeOnly(),
        { emoji: BROWSE_EMOJI },
      );
      return;
    }

    const listRows = result.items.map((item) => ({
      id: makeBarRowId(item.rawId),
      title: item.title,
      description: item.description,
    }));

    const nextCode = result.nextOffset !== null
      ? result.items.length + 1
      : null;
    const prevCode = result.prevOffset !== null
      ? result.items.length + (nextCode !== null ? 2 : 1)
      : null;

    await setState(ctx.supabase, ctx.profileId, {
      key: "dine_bars",
      data: {
        offset,
        bar_ids: result.items.map((item) => item.rawId),
        bar_slugs: result.items.map((item) => item.slug),
        next_offset: result.nextOffset,
        prev_offset: result.prevOffset,
        next_code: nextCode,
        prev_code: prevCode,
      },
    });

    await sendListMessage(
      ctx,
      {
        title: copy("bars.list.title"),
        body: copy("bars.list.body"),
        sectionTitle: "Bars",
        buttonText: "Select",
        rows: listRows,
      },
      { emoji: BROWSE_EMOJI },
    );
  } catch (err) {
    await logFlowAction(ctx, "bars_list_error", "dine_bars", {
      message: err instanceof Error ? err.message : String(err),
    });
    await sendButtonsMessage(
      ctx,
      copy("error.retry"),
      homeOnly(),
      { emoji: ERROR_EMOJI },
    );
  }
}

export async function handleBarRow(
  ctx: RouterContext,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId || !isBarRow(id)) return false;
  const barId = parseBarId(id);
  await logFlowAction(ctx, "select_bar", "dine_bars", { bar_id: barId });
  await promptBarMenu(ctx, barId);
  return true;
}

async function promptBarMenu(ctx: RouterContext, barId: string): Promise<void> {
  const profile = await fetchBarProfile(ctx.supabase, barId);
  if (!profile) {
    await sendButtonsMessage(
      ctx,
      copy("bars.unavailable"),
      homeOnly(),
      { emoji: ERROR_EMOJI },
    );
    await sendBarList(ctx, 0);
    return;
  }
  await presentBarMenu(ctx, profile);
}

async function presentBarMenu(
  ctx: RouterContext,
  profile: BarProfile,
  options: { resume?: boolean } = {},
): Promise<void> {
  if (!ctx.profileId) return;
  const canManage = await isManagerForBar(ctx, profile.id);
  await setState(ctx.supabase, ctx.profileId, {
    key: "dine_bar",
    data: {
      bar_id: profile.id,
      bar_name: profile.name,
      bar_location: profile.location,
      bar_slug: profile.slug,
      can_manage: canManage,
    },
  });
  await sendMenuPrompt(ctx, profile, {
    resume: options.resume,
    canManage,
  });
}

async function sendMenuPrompt(
  ctx: RouterContext,
  profile: Pick<BarProfile, "id" | "name" | "location" | "slug">,
  options: { resume?: boolean; canManage?: boolean },
): Promise<void> {
  const body = copy("bars.menuPrompt", {
    name: truncate(profile.name, 60),
    location: truncate(profile.location, 80),
  });
  const rows = [
    {
      id: DINE_IDS.MENU,
      title: copy("buttons.viewMenu"),
      description: "Browse the menu and order instantly.",
    },
  ];
  if (options.canManage) {
    rows.push({
      id: DINE_IDS.MENU_QR,
      title: `${QR_EMOJI} ${copy("buttons.menuQr")}`,
      description: "Generate a QR code that links to this menu.",
    });
    rows.push({
      id: DINE_IDS.MANAGE_BAR,
      title: `${MANAGER_EMOJI} Manager tools`,
      description: "Open the staff toolkit for this bar.",
    });
  }
  rows.push({
    id: IDS.BACK_MENU,
    title: "🏠 Home",
    description: "Return to the main menu.",
  });

  await sendListMessage(
    ctx,
    {
      title: copy("bars.list.title"),
      body,
      sectionTitle: copy("bars.options"),
      rows,
      buttonText: "Select",
    },
    { emoji: BROWSE_EMOJI },
  );
}

export async function handleBarsPagingButton(
  ctx: RouterContext,
  id: string,
  state: ChatState,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== "dine_bars") return false;
  await logFlowAction(ctx, "bars_paging", state.key, { id });
  const nextOffset = typeof state.data?.next_offset === "number"
    ? Number(state.data.next_offset)
    : null;
  const prevOffset = typeof state.data?.prev_offset === "number"
    ? Number(state.data.prev_offset)
    : null;
  if (id === DINE_IDS.BARS_NEXT && nextOffset !== null) {
    await sendBarList(ctx, nextOffset);
    return true;
  }
  if (id === DINE_IDS.BARS_PREV && prevOffset !== null) {
    await sendBarList(ctx, prevOffset);
    return true;
  }
  return false;
}

export async function openManagerPortal(
  ctx: RouterContext,
  state: ChatState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const barId = typeof state.data?.bar_id === "string"
    ? state.data.bar_id
    : null;
  const barName = typeof state.data?.bar_name === "string"
    ? state.data.bar_name
    : null;
  if (!barId) {
    await sendButtonsMessage(
      ctx,
      copy("cart.chooseBar"),
      homeOnly(),
      { emoji: ERROR_EMOJI },
    );
    return false;
  }

  const canManage = await isManagerForBar(ctx, barId);
  if (!canManage) {
    await sendButtonsMessage(
      ctx,
      copy("manager.access.denied", { bar: barName ?? "this bar" }),
      homeOnly(),
      { emoji: MANAGER_EMOJI },
    );
    return true;
  }

  await ensureSession({
    waId: normalizeWa(ctx.from),
    role: "vendor_manager",
    barId,
    currentFlow: "flow.vend.orders.v1",
  });

  await sendListMessage(
    ctx,
    {
      title: `${MANAGER_EMOJI} Manager tools`,
      body: copy("manager.access.granted", { bar: barName ?? "this bar" }),
      sectionTitle: "Actions",
      buttonText: "Select",
      rows: [
        {
          id: DINE_IDS.MENU,
          title: copy("buttons.viewMenu"),
          description: "Return to the customer menu.",
        },
        {
          id: DINE_IDS.MENU_QR,
          title: `${QR_EMOJI} ${copy("buttons.menuQr")}`,
          description: "Generate a QR code that links to this menu.",
        },
        {
          id: IDS.BACK_MENU,
          title: "🏠 Home",
          description: "Return to the main menu.",
        },
      ],
    },
    { emoji: MANAGER_EMOJI },
  );

  await sendFlowMessage(ctx.from, "flow.vend.orders.v1", {
    metadata: { bar_id: barId },
  });

  return true;
}

export async function sendMenuQr(
  ctx: RouterContext,
  state: ChatState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const slugFromState = stateBarSlug(state);
  const barId = resolveBarId(state);
  let profile: BarProfile | null = null;
  if (slugFromState) {
    profile = await fetchBarProfileBySlug(ctx.supabase, slugFromState);
  }
  if (!profile && barId) {
    profile = await fetchBarProfile(ctx.supabase, barId);
  }
  if (!profile) {
    await sendButtonsMessage(
      ctx,
      copy("bars.unavailable"),
      homeOnly(),
      { emoji: ERROR_EMOJI },
    );
    return true;
  }

  await logFlowAction(ctx, "menu_qr", state.key, { bar_id: profile.id });
  const link = buildMenuDeeplink(profile.slug);
  const qrUrl = `https://quickchart.io/qr?size=512&margin=1&text=${
    encodeURIComponent(link)
  }`;
  const barLabel = stateBarName(state) ?? profile.name;
  const caption = [
    `${truncate(barLabel, 60)} — easyMO menu`,
    link,
    "Scan to open this menu in WhatsApp.",
  ].join("\n");

  await sendImageUrl(ctx.from, qrUrl, caption);
  return true;
}

export async function openBarBySlug(
  ctx: RouterContext,
  slug: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return false;
  const profile = await fetchBarProfileBySlug(ctx.supabase, normalized);
  if (!profile) {
    await sendButtonsMessage(
      ctx,
      copy("bars.unavailable"),
      homeOnly(),
      { emoji: ERROR_EMOJI },
    );
    return true;
  }
  await logFlowAction(ctx, "open_bar_by_slug", "direct", {
    bar_id: profile.id,
    bar_slug: profile.slug,
  });
  await presentBarMenu(ctx, profile);
  return true;
}

function resolveBarId(state: ChatState): string | null {
  const barId = state.data?.bar_id;
  if (typeof barId === "string" && barId.length) return barId;
  return null;
}

async function fetchBars(
  ctx: RouterContext,
  offset: number,
): Promise<BarListResult> {
  const { data, error } = await ctx.supabase
    .from("bars")
    .select("id, slug, name, location_text, city_area, country")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .range(offset, offset + PAGE_SIZE);
  if (error) throw error;
  const rows = (data ?? []).map((bar) => ({
    rawId: bar.id,
    slug: (bar.slug ?? bar.id ?? "").toLowerCase(),
    title: truncate(bar.name, 60),
    description: truncate(
      buildLocationLabel([bar.location_text, bar.city_area, bar.country]),
      60,
    ),
  }));
  const displayRows = rows.slice(0, PAGE_SIZE);
  const hasNext = rows.length > PAGE_SIZE;
  return {
    items: displayRows,
    nextOffset: hasNext ? offset + PAGE_SIZE : null,
    prevOffset: offset > 0 ? Math.max(offset - PAGE_SIZE, 0) : null,
  };
}

async function countActiveBars(ctx: RouterContext): Promise<number> {
  const { count, error } = await ctx.supabase
    .from("bars")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}

async function isManagerForBar(
  ctx: RouterContext,
  barId: string,
): Promise<boolean> {
  const waId = normalizeWa(ctx.from);
  if (waId === CAMELLIA_MANAGER_E164) return true;
  const { data, error } = await ctx.supabase
    .from("bar_numbers")
    .select("id")
    .eq("bar_id", barId)
    .eq("number_e164", waId)
    .eq("role", "manager")
    .eq("is_active", true)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return Boolean(data);
}

function normalizeWa(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("+")) {
    return `+${trimmed.replace(/^\++/, "")}`;
  }
  return `+${trimmed.replace(/^\++/, "")}`;
}

function buildLocationLabel(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part && part.length))
    .join(" · ");
}
