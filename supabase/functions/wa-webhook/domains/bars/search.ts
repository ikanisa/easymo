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

  await setState(ctx.supabase, ctx.profileId, {
    key: "bars_search",
    data: {},
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "bars.search.intro"),
    buildButtons(
      {
        id: "bars_search_now",
        title: t(ctx.locale, "bars.buttons.search_now"),
      },
      {
        id: IDS.BACK_MENU,
        title: t(ctx.locale, "common.menu_back"),
      },
    ),
  );

  return true;
}

export async function handleBarsSearchButton(
  ctx: RouterContext,
  buttonId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  if (buttonId === "bars_search_now") {
    await setState(ctx.supabase, ctx.profileId, {
      key: "bars_wait_location",
      data: {},
    });

    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "bars.search.share_location"),
      buildButtons(
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.buttons.cancel"),
        },
      ),
    );

    return true;
  }

  return false;
}

export async function handleBarsLocation(
  ctx: RouterContext,
  location: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("BARS_SEARCH_LOCATION_RECEIVED", {
    wa_id: `***${ctx.from.slice(-4)}`,
    lat: location.lat.toFixed(4),
    lng: location.lng.toFixed(4),
  });

  // Search for nearby bars using the database function
  const { data: bars, error } = await ctx.supabase
    .rpc("nearby_bars", {
      user_lat: location.lat,
      user_lon: location.lng,
      radius_km: 10,
      _limit: 10,
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
      t(ctx.locale, "bars.search.no_results"),
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
      bars: bars.map((bar: any) => ({
        id: bar.id,
        name: bar.name,
        address: bar.address,
        distance: bar.distance,
        whatsapp: bar.whatsapp_number,
      })),
    },
  });

  // Build list message with results
  const rows = bars.slice(0, 10).map((bar: any, idx: number) => {
    const distance = typeof bar.distance === 'number'
      ? (bar.distance < 1
        ? `${Math.round(bar.distance * 1000)}m`
        : `${bar.distance.toFixed(1)}km`)
      : 'Distance unknown';

    return {
      id: `bar_result_${idx}`,
      title: bar.name || `Bar #${idx + 1}`,
      description: `${bar.address || "Address not available"} • ${distance} away`,
    };
  });

  // Add back button
  rows.push({
    id: IDS.BACK_MENU,
    title: t(ctx.locale, "common.menu_back"),
    description: t(ctx.locale, "common.back_to_menu.description"),
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "bars.results.title"),
      body: t(ctx.locale, "bars.results.found", {
        count: bars.length.toString(),
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
  });

  return true;
}

export async function handleBarsResultSelection(
  ctx: RouterContext,
  state: { bars?: Array<{
    id: string;
    name: string;
    address?: string;
    distance?: number;
    whatsapp?: string;
  }> },
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

  let message = `*${bar.name}*\n\n`;
  if (bar.address) message += `📍 ${bar.address}\n`;
  message += `📏 ${distance} away\n`;
  if (bar.whatsapp) message += `📞 WhatsApp: ${bar.whatsapp}\n`;

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
  });

  return true;
}
