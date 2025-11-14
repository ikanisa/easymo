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

  // Store preference and move to location request
  await setState(ctx.supabase, ctx.profileId, {
    key: "bars_wait_location",
    data: { preference },
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "bars.search.share_location"),
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
  state?: { preference?: string },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const preference = state?.preference || "all";

  await logStructuredEvent("BARS_SEARCH_LOCATION_RECEIVED", {
    wa_id: `***${ctx.from.slice(-4)}`,
    lat: location.lat.toFixed(4),
    lng: location.lng.toFixed(4),
    preference,
  });

  // Search for nearby bars using the preference-based function
  const { data: bars, error } = await ctx.supabase
    .rpc("nearby_bars_by_preference", {
      user_lat: location.lat,
      user_lon: location.lng,
      preference: preference,
      radius_km: 10,
      _limit: 9,
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

  // Store results in state
  await setState(ctx.supabase, ctx.profileId, {
    key: "bars_results",
    data: {
      userLocation: location,
      preference,
      bars: bars.map((bar: any) => ({
        id: bar.id,
        name: bar.name,
        address: bar.location_text,
        distance: bar.distance_km,
        whatsapp: bar.whatsapp_number,
        features: bar.features,
      })),
    },
  });

  // Build list message with results
  const rows = bars.slice(0, 9).map((bar: any, idx: number) => {
    const distance = typeof bar.distance_km === 'number'
      ? (bar.distance_km < 1
        ? `${Math.round(bar.distance_km * 1000)}m`
        : `${bar.distance_km.toFixed(1)}km`)
      : 'Distance unknown';

    return {
      id: `bar_result_${idx}`,
      title: bar.name || `Bar #${idx + 1}`,
      description: `${bar.location_text || "Address not available"} • ${distance} away`,
    };
  });

  // Add back button
  rows.push({
    id: IDS.BACK_MENU,
    title: t(ctx.locale, "common.menu_back"),
    description: t(ctx.locale, "common.back_to_menu.description"),
  });

  const preferenceText = preference !== "all" 
    ? ` ${t(ctx.locale, `bars.preferences.${preference}`).toLowerCase()}`
    : "";

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "bars.results.title"),
      body: t(ctx.locale, "bars.results.found_with_preference", {
        count: bars.length.toString(),
        preference: preferenceText,
      }),
      sectionTitle: t(ctx.locale, "bars.results.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.choose"),
    },
    { emoji: "🍺" },
  );

  await logStructuredEvent("BARS_SEARCH_RESULTS_SENT", {
    wa_id: `***${ctx.from.slice(-4)}`,
    count: bars.length,
    preference,
  });

  return true;
}

export async function handleBarsResultSelection(
  ctx: RouterContext,
  state: { 
    bars?: Array<{
      id: string;
      name: string;
      address?: string;
      distance?: number;
      whatsapp?: string;
      features?: any;
    }>;
    preference?: string;
  },
  selectionId: string,
): Promise<boolean> {
  if (!state.bars) return false;

  const match = selectionId.match(/^bar_result_(\d+)$/);
  if (!match) return false;

  const idx = parseInt(match[1]);
  const bar = state.bars[idx];
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

  await sendButtonsMessage(
    ctx,
    message,
    buildButtons(
      {
        id: "bars_search_now",
        title: t(ctx.locale, "bars.buttons.search_again"),
      },
      {
        id: IDS.BACK_MENU,
        title: t(ctx.locale, "common.menu_back"),
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
