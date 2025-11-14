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

export async function startShopsAndServices(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // DIRECTLY show categories list - NO intro message
  return await handleShopsBrowseButton(ctx);
}

export async function handleShopsBrowseButton(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Get tags from business_tags table with counts
  const { data: tags, error } = await ctx.supabase
    .rpc("get_shops_tags");

  if (error) {
    console.error("shops.tags_fetch_fail", error);
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "shops.tags.error"),
      homeOnly(),
    );
    return true;
  }

  if (!tags || tags.length === 0) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "shops.tags.empty"),
      buildButtons(
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
        },
      ),
    );
    return true;
  }

  // Store tags in state
  await setState(ctx.supabase, ctx.profileId, {
    key: "shops_tag_selection",
    data: {
      tags: tags.map((tag: any) => ({
        id: tag.tag_id,
        name: tag.tag_name,
        slug: tag.tag_slug,
        icon: tag.icon,
        description: tag.description,
        count: tag.business_count,
      })),
    },
  });

  // Build list rows (top 9 tags)
  const rows = tags.slice(0, 9).map((tag: any, idx: number) => ({
    id: `shop_tag_${idx}`,
    title: `${tag.icon || "🏷️"} ${tag.tag_name}`,
    description: `${tag.business_count} ${tag.business_count === 1 ? "business" : "businesses"}`,
  }));

  // Add back button
  rows.push({
    id: IDS.BACK_MENU,
    title: t(ctx.locale, "common.menu_back"),
    description: t(ctx.locale, "common.back_to_menu.description"),
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "shops.tags.title"),
      body: t(ctx.locale, "shops.tags.body"),
      sectionTitle: t(ctx.locale, "shops.tags.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.view"),
    },
    { emoji: "🏪" },
  );

  await logStructuredEvent("SHOPS_TAGS_SHOWN", {
    wa_id: `***${ctx.from.slice(-4)}`,
    tag_count: tags.length,
  });

  return true;
}

export async function handleShopsTagSelection(
  ctx: RouterContext,
  state: { tags?: Array<{ id: string; name: string; slug: string; icon?: string; count: number }> },
  selectionId: string,
): Promise<boolean> {
  if (!ctx.profileId || !state.tags) return false;

  const match = selectionId.match(/^shop_tag_(\d+)$/);
  if (!match) return false;

  const idx = parseInt(match[1]);
  const tag = state.tags[idx];
  if (!tag) return false;

  // Set state to wait for location
  await setState(ctx.supabase, ctx.profileId, {
    key: "shops_wait_location",
    data: {
      tag_id: tag.id,
      tag_name: tag.name,
      tag_icon: tag.icon,
    },
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "shops.location.prompt", { category: tag.name }),
    buildButtons(
      {
        id: IDS.LOCATION_SAVED_LIST,
        title: t(ctx.locale, "location.saved.button"),
      },
      {
        id: IDS.BACK_MENU,
        title: t(ctx.locale, "common.buttons.cancel"),
      },
    ),
  );

  await logStructuredEvent("SHOPS_TAG_SELECTED", {
    wa_id: `***${ctx.from.slice(-4)}`,
    tag_id: tag.id,
    tag_name: tag.name,
  });

  return true;
}

export async function handleShopsLocation(
  ctx: RouterContext,
  state: { tag_id?: string; tag_name?: string; tag_icon?: string; page?: number },
  location: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId || !state.tag_id) return false;

  const page = state.page || 0;

  await logStructuredEvent("SHOPS_LOCATION_RECEIVED", {
    wa_id: `***${ctx.from.slice(-4)}`,
    tag_id: state.tag_id,
    lat: location.lat.toFixed(4),
    lng: location.lng.toFixed(4),
  });

  // Search for businesses by tag_id from business_tags table (get 27 results)
  const { data: businesses, error } = await ctx.supabase
    .rpc("get_shops_by_tag_id", {
      p_tag_id: state.tag_id,
      p_user_lat: location.lat,
      p_user_lon: location.lng,
      p_radius_km: 10,
      p_limit: 27,
    });

  if (error) {
    console.error("shops.search_fail", error);
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "shops.search.error"),
      homeOnly(),
    );
    return true;
  }

  if (!businesses || businesses.length === 0) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "shops.search.no_results", { category: state.tag_name }),
      buildButtons(
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
        },
      ),
    );
    return true;
  }

  // Store ALL results in state for pagination
  await setState(ctx.supabase, ctx.profileId, {
    key: "shops_results",
    data: {
      userLocation: location,
      tag_id: state.tag_id,
      tag_name: state.tag_name,
      tag_icon: state.tag_icon,
      page: page,
      businesses: businesses.map((biz: any) => ({
        id: biz.id,
        name: biz.name,
        description: biz.description,
        distance_km: biz.distance_km,
        whatsapp: biz.owner_whatsapp,
        location: biz.location_text,
      })),
    },
  });

  // Show first 9 results (page 0)
  const start = page * 9;
  const end = Math.min(start + 9, businesses.length);
  const pageResults = businesses.slice(start, end);
  const hasMore = end < businesses.length;

  // Build list message with results
  const rows = pageResults.map((biz: any, idx: number) => {
    const distance = biz.distance_km < 1
      ? `${Math.round(biz.distance_km * 1000)}m`
      : `${biz.distance_km.toFixed(1)}km`;

    return {
      id: `shop_result_${start + idx}`,
      title: biz.name || `Business #${start + idx + 1}`,
      description: `${biz.location_text || "No location"} • ${distance}`,
    };
  });

  // Add "More" button if there are more results
  if (hasMore) {
    rows.push({
      id: "shops_more",
      title: t(ctx.locale, "common.buttons.more"),
      description: t(ctx.locale, "common.see_more_results"),
    });
  }

  // Add back button
  rows.push({
    id: IDS.BACK_MENU,
    title: t(ctx.locale, "common.menu_back"),
    description: t(ctx.locale, "common.back_to_menu.description"),
  });

  await sendListMessage(
    ctx,
    {
      title: `${state.tag_icon || "🏪"} ${state.tag_name}`,
      body: t(ctx.locale, "shops.results.found", {
        count: businesses.length.toString(),
        category: state.tag_name,
      }),
      sectionTitle: t(ctx.locale, "shops.results.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.view"),
    },
    { emoji: state.tag_icon || "🏪" },
  );

  await logStructuredEvent("SHOPS_RESULTS_SENT", {
    wa_id: `***${ctx.from.slice(-4)}`,
    tag_id: state.tag_id,
    count: businesses.length,
  });

  return true;
}

export async function handleShopsResultSelection(
  ctx: RouterContext,
  state: {
    businesses?: Array<{
      id: string;
      name: string;
      description?: string;
      distance_km?: number;
      whatsapp?: string;
      location?: string;
    }>;
    tag_name?: string;
    tag_icon?: string;
  },
  selectionId: string,
): Promise<boolean> {
  if (!state.businesses) return false;

  const match = selectionId.match(/^shop_result_(\d+)$/);
  if (!match) return false;

  const idx = parseInt(match[1]);
  const business = state.businesses[idx];
  if (!business) return false;

  const distance = business.distance_km && business.distance_km < 1
    ? `${Math.round(business.distance_km * 1000)}m`
    : business.distance_km
    ? `${business.distance_km.toFixed(1)}km`
    : "Distance unknown";

  // Simple, clean message with WhatsApp contact
  let message = `*${business.name}*\n\n`;
  if (business.location) message += `📍 ${business.location}\n`;
  message += `📏 ${distance} away\n\n`;
  
  if (business.whatsapp) {
    message += `📞 *WhatsApp Contact:*\n${business.whatsapp}\n\n`;
    message += `Tap the number to chat with them directly!`;
  } else {
    message += `ℹ️ No WhatsApp contact available for this business.`;
  }

  await sendButtonsMessage(
    ctx,
    message,
    buildButtons(
      {
        id: IDS.BACK_MENU,
        title: t(ctx.locale, "common.menu_back"),
      },
    ),
  );

  await logStructuredEvent("SHOPS_RESULT_VIEWED", {
    wa_id: `***${ctx.from.slice(-4)}`,
    business_id: business.id,
  });

  return true;
}

export async function handleShopsMore(
  ctx: RouterContext,
  state: {
    businesses?: Array<{
      id: string;
      name: string;
      description?: string;
      distance_km?: number;
      whatsapp?: string;
      location?: string;
    }>;
    tag_id?: string;
    tag_name?: string;
    tag_icon?: string;
    page?: number;
    userLocation?: { lat: number; lng: number };
  },
): Promise<boolean> {
  if (!ctx.profileId || !state.businesses || !state.userLocation) return false;

  const currentPage = state.page || 0;
  const nextPage = currentPage + 1;
  
  // Update state with new page
  await setState(ctx.supabase, ctx.profileId, {
    key: "shops_results",
    data: {
      ...state,
      page: nextPage,
    },
  });

  // Show next 9 results
  const start = nextPage * 9;
  const end = Math.min(start + 9, state.businesses.length);
  const pageResults = state.businesses.slice(start, end);
  const hasMore = end < state.businesses.length;

  const rows = pageResults.map((biz, idx) => {
    const distance = biz.distance_km && biz.distance_km < 1
      ? `${Math.round(biz.distance_km * 1000)}m`
      : biz.distance_km
      ? `${biz.distance_km.toFixed(1)}km`
      : "Distance unknown";

    return {
      id: `shop_result_${start + idx}`,
      title: biz.name || `Business #${start + idx + 1}`,
      description: `${biz.location || "No location"} • ${distance}`,
    };
  });

  // Add "More" button if there are more results
  if (hasMore) {
    rows.push({
      id: "shops_more",
      title: t(ctx.locale, "common.buttons.more"),
      description: t(ctx.locale, "common.see_more_results"),
    });
  }

  // Add back button
  rows.push({
    id: IDS.BACK_MENU,
    title: t(ctx.locale, "common.menu_back"),
    description: t(ctx.locale, "common.back_to_menu.description"),
  });

  await sendListMessage(
    ctx,
    {
      title: `${state.tag_icon || "🏪"} ${state.tag_name}`,
      body: t(ctx.locale, "shops.results.showing_more", {
        from: String(start + 1),
        to: String(end),
        total: String(state.businesses.length),
        category: state.tag_name,
      }),
      sectionTitle: t(ctx.locale, "shops.results.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.view"),
    },
    { emoji: state.tag_icon || "🏪" },
  );

  return true;
}
