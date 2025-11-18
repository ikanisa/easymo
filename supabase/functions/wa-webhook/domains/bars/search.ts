import type { RouterContext } from "../../types.ts";
import { setState } from "../../state/store.ts";
import { t } from "../../i18n/translator.ts";
import {
  buildButtons,
  homeOnly,
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import {
  startMenuOrderSession,
  type MenuOrderItem,
  type MenuOrderSession,
} from "../orders/menu_order.ts";
import { getState } from "../../state/store.ts";
import { recordRecentActivity } from "../locations/recent.ts";
import { sendText } from "../../wa/client.ts";

type BarSummary = {
  id: string;
  name: string;
  address?: string;
  distance?: number;
  whatsapp?: string;
  country?: string;
  slug?: string;
  features?: unknown;
};

type BarsResultsState = {
  bars?: BarSummary[];
  preference?: string;
  page?: number;
  userLocation?: { lat: number; lng: number };
};

export async function startBarsSearch(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Step 1: Show preferences selection
  await setState(ctx.supabase, ctx.profileId, {
    key: "bars_wait_preference",
    data: {},
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "bars.preferences.title"),
      body: t(ctx.locale, "bars.preferences.body"),
      sectionTitle: t(ctx.locale, "bars.preferences.section"),
      rows: [
        {
          id: "bars_pref_all",
          title: t(ctx.locale, "bars.preferences.all"),
          description: t(ctx.locale, "bars.preferences.all_desc"),
        },
        {
          id: "bars_pref_live_music",
          title: t(ctx.locale, "bars.preferences.live_music"),
          description: t(ctx.locale, "bars.preferences.live_music_desc"),
        },
        {
          id: "bars_pref_parking",
          title: t(ctx.locale, "bars.preferences.parking"),
          description: t(ctx.locale, "bars.preferences.parking_desc"),
        },
        {
          id: "bars_pref_free_wifi",
          title: t(ctx.locale, "bars.preferences.wifi"),
          description: t(ctx.locale, "bars.preferences.wifi_desc"),
        },
        {
          id: "bars_pref_family_friendly",
          title: t(ctx.locale, "bars.preferences.family"),
          description: t(ctx.locale, "bars.preferences.family_desc"),
        },
        {
          id: "bars_pref_vegetarian",
          title: t(ctx.locale, "bars.preferences.vegetarian"),
          description: t(ctx.locale, "bars.preferences.vegetarian_desc"),
        },
        {
          id: "bars_pref_live_sports",
          title: t(ctx.locale, "bars.preferences.sports"),
          description: t(ctx.locale, "bars.preferences.sports_desc"),
        },
        {
          id: "bars_pref_outdoor_seating",
          title: t(ctx.locale, "bars.preferences.outdoor"),
          description: t(ctx.locale, "bars.preferences.outdoor_desc"),
        },
        {
          id: "bars_pref_late_night",
          title: t(ctx.locale, "bars.preferences.late_night"),
          description: t(ctx.locale, "bars.preferences.late_night_desc"),
        },
        {
          id: "bars_pref_happy_hour",
          title: t(ctx.locale, "bars.preferences.happy_hour"),
          description: t(ctx.locale, "bars.preferences.happy_hour_desc"),
        },
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
          description: t(ctx.locale, "common.back_to_menu.description"),
        },
      ],
      buttonText: t(ctx.locale, "common.buttons.choose"),
    },
    { emoji: "🍺" },
  );

  return true;
}

export async function handleBarsPreferenceSelection(
  ctx: RouterContext,
  selectionId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Extract preference from selection ID
  const match = selectionId.match(/^bars_pref_(.+)$/);
  if (!match) return false;

  const preference = match[1];

  // Try recent location within TTL first to skip ask
  const { getRecentLocation } = await import("../locations/recent.ts");
  const recent = await getRecentLocation(ctx, 'bars');
  if (recent) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "bars_wait_location",
      data: { preference },
    });
    return await handleBarsLocation(ctx, recent, { preference, page: 0 });
  }

  // Store preference and move to location request
  await setState(ctx.supabase, ctx.profileId, {
    key: "bars_wait_location",
    data: { preference },
  });

  const instructions = t(ctx.locale, "location.share.instructions");
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "bars.search.share_location", { instructions }),
    buildButtons(
      {
        id: IDS.LOCATION_SAVED_LIST,
        title: t(ctx.locale, "location.saved.button"),
      },
      {
        id: IDS.BACK_MENU,
        title: t(ctx.locale, "common.menu_back"),
      },
    ),
  );

  await logStructuredEvent("BARS_PREFERENCE_SELECTED", {
    wa_id: `***${ctx.from.slice(-4)}`,
    preference,
  });

  return true;
}

// Removed handleBarsSearchButton - no longer needed, goes direct to location

export async function handleBarsLocation(
  ctx: RouterContext,
  location: { lat: number; lng: number },
  state?: { preference?: string; page?: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const preference = state?.preference || "all";
  const page = state?.page || 0;

  await logStructuredEvent("BARS_SEARCH_LOCATION_RECEIVED", {
    wa_id: `***${ctx.from.slice(-4)}`,
    lat: location.lat.toFixed(4),
    lng: location.lng.toFixed(4),
    preference,
  });

  // Search for nearby bars using the preference-based function (get 27 results)
  const { data: bars, error } = await ctx.supabase
    .rpc("nearby_bars_by_preference", {
      user_lat: location.lat,
      user_lon: location.lng,
      preference: preference,
      radius_km: 10,
      _limit: 27,
    });

  if (error) {
    console.error("bars.search_fail", error);
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "bars.search.error"),
      homeOnly(),
    );
    return true;
  }

  if (!bars || bars.length === 0) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "bars.search.no_results_preference", {
        preference: t(ctx.locale, `bars.preferences.${preference}`),
      }),
      buildButtons(
        {
          id: "bars_search_now",
          title: t(ctx.locale, "bars.buttons.try_again"),
        },
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
        },
      ),
    );
    return true;
  }

  const normalizedBars: BarSummary[] = bars.map((bar: any) => ({
    id: bar.id,
    name: bar.name,
    address: bar.location_text,
    country: bar.country,
    slug: bar.slug,
    distance: typeof bar.distance_km === "number" ? bar.distance_km : undefined,
    whatsapp: bar.whatsapp_number,
    features: bar.features,
  }));

  const storedState: BarsResultsState = {
    userLocation: location,
    preference,
    page,
    bars: normalizedBars,
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: "bars_results",
    data: storedState,
  });

  await sendBarsResultsPage(ctx, storedState, { mode: "found" });

  await logStructuredEvent("BARS_SEARCH_RESULTS_SENT", {
    wa_id: `***${ctx.from.slice(-4)}`,
    count: normalizedBars.length,
    preference,
  });

  return true;
}

export async function handleBarsResultSelection(
  ctx: RouterContext,
  state: BarsResultsState,
  selectionId: string,
): Promise<boolean> {
  const bars = state?.bars ?? [];
  if (!bars.length) return false;

  const match = selectionId.match(/^bar_result_(\d+)$/);
  if (!match) return false;

  const idx = parseInt(match[1]);
  const bar = bars[idx];
  if (!bar) return false;

  const distance = bar.distance && bar.distance < 1
    ? `${Math.round(bar.distance * 1000)}m`
    : bar.distance
    ? `${bar.distance.toFixed(1)}km`
    : "Distance unknown";

  let message = `🍺 *${bar.name}*\n\n`;
  if (bar.address) message += `📍 ${bar.address}\n`;
  message += `📏 ${distance} away\n\n`;
  
  if (bar.whatsapp) {
    message += `📞 *WhatsApp:* ${bar.whatsapp}\n\n`;
    message += t(ctx.locale, "bars.result.whatsapp_prompt");
  } else {
    message += t(ctx.locale, "bars.result.no_whatsapp");
  }

  // Store bar info for AI waiter + menu context
  if (ctx.profileId) {
    const snapshot: BarsResultsState = {
      bars,
      preference: state?.preference,
      page: state?.page,
      userLocation: state?.userLocation,
    };
    await setState(ctx.supabase, ctx.profileId, {
      key: "bar_detail",
      data: {
        barId: bar.id,
        barName: bar.name,
        barCountry: (bar as any).country,
        barSlug: (bar as any).slug,
        barWhatsApp: bar.whatsapp,
        barsResults: snapshot,
      },
    });
    // Record recent activity for quick resume on Home
    try {
      await recordRecentActivity(ctx, 'bar_detail', bar.id, {
        barId: bar.id,
        barName: bar.name,
        barCountry: (bar as any).country ?? null,
        barSlug: (bar as any).slug ?? null,
      });
    } catch (_) { /* non-fatal */ }
  }

  await sendButtonsMessage(
    ctx,
    message,
    buildButtons(
      {
        id: IDS.BAR_VIEW_MENU,
        title: t(ctx.locale, "bars.buttons.view_menu"),
      },
      {
        id: "bar_chat_waiter",
        title: t(ctx.locale, "bars.buttons.chat_waiter"),
      },
      {
        id: "bars_search_now",
        title: t(ctx.locale, "bars.buttons.search_again"),
      },
    ),
  );

  await logStructuredEvent("BARS_RESULT_VIEWED", {
    wa_id: `***${ctx.from.slice(-4)}`,
    bar_id: bar.id,
    has_whatsapp: !!bar.whatsapp,
  });

  return true;
}

export async function handleBarsMore(
  ctx: RouterContext,
  state: BarsResultsState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const bars = state?.bars ?? [];
  if (!bars.length) return false;

  const currentPage = state.page ?? 0;
  const nextPage = currentPage + 1;
  const updatedState: BarsResultsState = {
    ...state,
    page: nextPage,
    bars,
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: "bars_results",
    data: updatedState,
  });

  await sendBarsResultsPage(ctx, updatedState, { mode: "more" });
  return true;
}

export async function replayBarsResults(
  ctx: RouterContext,
  state: BarsResultsState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const bars = state?.bars ?? [];
  if (!bars.length) return false;
  const resetState: BarsResultsState = {
    ...state,
    page: 0,
    bars,
  };
  await setState(ctx.supabase, ctx.profileId, {
    key: "bars_results",
    data: resetState,
  });
  await sendBarsResultsPage(ctx, resetState, { mode: "found" });
  return true;
}

export async function startBarMenuOrder(
  ctx: RouterContext,
  detail: Record<string, unknown>,
): Promise<boolean> {
  try {
    if (!ctx.profileId) return false;
    const barId = typeof detail?.barId === "string" ? detail.barId : null;
    const barName = typeof detail?.barName === "string"
      ? detail.barName
      : t(ctx.locale, "bars.menu.unknown_name");
    if (!barId) return false;

    try {
      console.log(JSON.stringify({ event: 'BAR_MENU_START', barId, barName }));
    } catch {}

    const menuItems = await fetchBarMenuItems(ctx, barId, { visited: new Set() });
    try {
      console.log(JSON.stringify({ event: 'BAR_MENU_ITEMS_RESULT', count: menuItems?.length ?? 0 }));
    } catch {}
    if (!menuItems.length) {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "bars.menu.no_items", { name: barName }),
        buildButtons(
          { id: "bar_chat_waiter", title: t(ctx.locale, "bars.buttons.chat_waiter") },
          { id: "bars_search_now", title: t(ctx.locale, "bars.buttons.search_again") },
        ),
      );
      return true;
    }

    const contacts = await fetchBarContactNumbers(ctx, barId);
    try {
      console.log(JSON.stringify({ event: 'BAR_MENU_CONTACTS_RESULT', count: contacts?.length ?? 0 }));
    } catch {}
    // If no contacts, proceed silently; order finalization will warn later.

    const session: MenuOrderSession = {
      vendorType: "bar",
      vendorId: barId,
      vendorName: barName,
      contactNumbers: contacts,
      menuItems,
      selections: [],
    };
    // Record menu view as recent activity
    try {
      await recordRecentActivity(ctx, 'bar_menu', barId, {
        barId,
        barName,
        menuCount: menuItems.length,
      });
    } catch (_) { /* ignore */ }
    return await startMenuOrderSession(ctx, session);
  } catch (error) {
    console.error("bars.view_menu_error", {
      barId: (detail as any)?.barId,
      message: error instanceof Error ? error.message : String(error ?? "err"),
    });
    // Fallback to plain text to avoid interactive validation issues
    try {
      await sendText(
        ctx.from,
        t(ctx.locale, "restaurant.menu.fetch_error"),
      );
    } catch (_) {
      // swallow
    }
    return true;
  }
}

async function fetchBarMenuItems(
  ctx: RouterContext,
  barId: string,
  opts?: { visited?: Set<string> }
): Promise<MenuOrderItem[]> {
  const visited = opts?.visited ?? new Set<string>();
  if (visited.has(barId)) {
    console.warn(JSON.stringify({ event: 'BAR_MENU_FETCH_GUARD_HIT', barId }));
    return [];
  }
  visited.add(barId);
  // barId may be a business.id (from business search) or bars.id.
  // 1) Try business_id first (new linkage)
  let rows: MenuOrderItem[] = [];
  try {
    console.log(JSON.stringify({ event: 'BAR_MENU_FETCH', mode: 'business_id', barId }));
    const { data, error } = await ctx.supabase
      .from("restaurant_menu_items")
      .select("id, name, category_name, price, currency, description")
      .eq("business_id", barId)
      .eq("is_available", true)
      .order("category_name", { ascending: true, nullsFirst: true })
      .order("name", { ascending: true })
      .limit(30);
    if (error) throw error;
    rows = (data ?? []).map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category_name ?? undefined,
      price: item.price,
      currency: item.currency,
      description: item.description ?? undefined,
    }));
    if (rows.length) return rows;
  } catch (_e) {
    // continue to next strategy
  }

  // 2) Try legacy query using bar_id (with new schema first)
  try {
    console.log(JSON.stringify({ event: 'BAR_MENU_FETCH', mode: 'bar_id_category_name', barId }));
    const { data, error } = await ctx.supabase
      .from("restaurant_menu_items")
      .select("id, name, category_name, price, currency, description")
      .eq("bar_id", barId)
      .eq("is_available", true)
      .order("category_name", { ascending: true, nullsFirst: true })
      .order("name", { ascending: true })
      .limit(30);
    if (error) throw error;
    rows = (data ?? []).map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category_name ?? undefined,
      price: item.price,
      currency: item.currency,
      description: item.description ?? undefined,
    }));
  } catch (err) {
    console.warn(JSON.stringify({ event: 'BAR_MENU_FETCH_WARN', mode: 'bar_id_category', error: String((err as any)?.message || err) }));
    // Fallback to legacy column name "category"
    const { data, error: err2 } = await ctx.supabase
      .from("restaurant_menu_items")
      .select("id, name, category, price, currency, description")
      .eq("bar_id", barId)
      .eq("is_available", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true })
      .limit(30);
    if (err2) {
      console.error("bars.menu_fetch_fail", err2);
      rows = [];
    } else {
      rows = (data ?? []).map((item: any) => ({
        id: item.id,
        name: item.name,
        category: item.category ?? undefined,
        price: item.price,
        currency: item.currency,
        description: item.description ?? undefined,
      }));
    }
  }

  if (rows.length) return rows;

  // If nothing found, the consumer barId likely comes from business.id.
  // Try to resolve the matching public.bars row by name/slug and retry.
  try {
    console.log(JSON.stringify({ event: 'BAR_MENU_FETCH', mode: 'resolve_bars_retry' }));
    let barName: string | undefined;
    let barSlug: string | undefined;
    let barCountry: string | undefined;
    if (ctx.profileId) {
      const chatState = await getState(ctx.supabase, ctx.profileId);
      const data: any = chatState?.data || {};
      // Prefer bar_detail payload if present
      if (chatState?.key === 'bar_detail') {
        barName = data?.barName;
        barSlug = data?.barSlug;
        barCountry = data?.barCountry;
      } else {
        barName = data?.barName;
        barSlug = data?.barSlug;
        barCountry = data?.barCountry;
      }
    }
    let query = ctx.supabase.from("bars").select("id, name, country, slug").limit(1);
    if (barSlug) {
      query = query.eq("slug", barSlug);
    } else if (barName) {
      query = query.ilike("name", barName);
      if (barCountry) query = query.eq("country", barCountry);
    }
    const { data: barRow } = await query.maybeSingle();
    if (barRow?.id) {
      console.log(JSON.stringify({ event: 'BAR_MENU_FETCH', mode: 'resolved_bar_id_retry', resolvedBarId: barRow.id }));
      // Retry with resolved bars.id
      if (barRow.id === barId) {
        // Prevent infinite recursion
        return [];
      }
      return await fetchBarMenuItems(ctx, barRow.id, { visited });
    }
  } catch (e) {
    // non-fatal
  }

  // Fallback: use shared Rwanda catalog mirrored into public.menu_items
  const { data: shared, error: sharedErr } = await ctx.supabase
    .from("menu_items")
    .select("id, name, price, currency, description, category_name")
    .eq("is_available", true)
    .or("metadata->>source.eq.mirror,metadata->>from.eq.restaurant_menu_items")
    .order("category_name", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true })
    .limit(30);
  if (sharedErr) {
    console.error("bars.menu_shared_fetch_fail", sharedErr);
    return [];
  }
  return (shared ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    category: item.category_name ?? undefined,
    price: item.price,
    currency: item.currency ?? 'RWF',
    description: item.description ?? undefined,
  }));
}

async function fetchBarContactNumbers(
  ctx: RouterContext,
  barId: string,
): Promise<string[]> {
  const { data, error } = await ctx.supabase
    .from("bar_numbers")
    .select("number_e164, role")
    .eq("bar_id", barId)
    .eq("is_active", true);
  if (error) {
    console.error("bars.menu_contact_fail", error);
    return [];
  }
  if (!data) return [];
  const managers = data.filter((row) => row.role === "manager");
  const target = managers.length ? managers : data;
  const numbers = target
    .map((row) => row.number_e164)
    .filter((value): value is string => Boolean(value && value.trim()));
  return Array.from(new Set(numbers));
}

type BarsResultsPageMode = "found" | "more";

async function sendBarsResultsPage(
  ctx: RouterContext,
  state: BarsResultsState,
  options: { mode: BarsResultsPageMode } = { mode: "found" },
): Promise<void> {
  const bars = state.bars ?? [];
  const total = bars.length;
  if (!total) return;

  const requestedPage = state.page ?? 0;
  const safePage = Math.max(0, Math.min(requestedPage, Math.floor((total - 1) / 9)));
  const start = safePage * 9;
  const end = Math.min(start + 9, total);
  const pageResults = bars.slice(start, end);
  const hasMore = end < total;

  const rows = pageResults.map((bar, idx) => {
    const distance = typeof bar.distance === "number"
      ? (bar.distance < 1
        ? `${Math.round(bar.distance * 1000)}m`
        : `${bar.distance.toFixed(1)}km`)
      : "Distance unknown";
    return {
      id: `bar_result_${start + idx}`,
      title: bar.name || `Bar #${start + idx + 1}`,
      description: `${bar.address || "Address not available"} • ${distance} away`,
    };
  });

  if (hasMore) {
    rows.push({
      id: "bars_more",
      title: t(ctx.locale, "common.buttons.more"),
      description: t(ctx.locale, "common.see_more_results"),
    });
  }

  rows.push({
    id: IDS.BACK_MENU,
    title: t(ctx.locale, "common.menu_back"),
    description: t(ctx.locale, "common.back_to_menu.description"),
  });

  const preferenceKey = state.preference ?? "all";
  const preferenceText = preferenceKey !== "all"
    ? ` ${t(ctx.locale, `bars.preferences.${preferenceKey}`).toLowerCase()}`
    : "";

  const body = options.mode === "more"
    ? t(ctx.locale, "bars.results.showing_more", {
      from: String(start + 1),
      to: String(end),
      total: String(total),
      preference: preferenceText,
    })
    : t(ctx.locale, "bars.results.found_with_preference", {
      count: total.toString(),
      preference: preferenceText,
    });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "bars.results.title"),
      body,
      sectionTitle: t(ctx.locale, "bars.results.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.choose"),
    },
    { emoji: "🍺" },
  );
}
