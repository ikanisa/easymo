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

  await setState(ctx.supabase, ctx.profileId, {
    key: "shops_services_menu",
    data: {},
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "shops.menu.intro"),
    buildButtons(
      {
        id: "shops_browse_tags",
        title: t(ctx.locale, "shops.buttons.browse"),
      },
      {
        id: IDS.BACK_MENU,
        title: t(ctx.locale, "common.menu_back"),
      },
    ),
  );

  return true;
}

export async function handleShopsBrowseButton(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Get active tags with business counts
  const { data: tags, error } = await ctx.supabase
    .rpc("get_active_business_tags");

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

  // Filter out tags with no businesses
  const activeTags = tags.filter((tag: any) => tag.business_count > 0);

  if (activeTags.length === 0) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "shops.tags.no_businesses"),
      homeOnly(),
    );
    return true;
  }

  // Store tags in state
  await setState(ctx.supabase, ctx.profileId, {
    key: "shops_tag_selection",
    data: {
      tags: activeTags.map((tag: any) => ({
        id: tag.id,
        slug: tag.slug,
        name: tag.name,
        count: tag.business_count,
      })),
    },
  });

  // Build list rows
  const rows = activeTags.slice(0, 10).map((tag: any, idx: number) => ({
    id: `shop_tag_${idx}`,
    title: `${tag.icon || "🏷️"} ${tag.name}`,
    description: `${tag.description} (${tag.business_count} ${tag.business_count === 1 ? "business" : "businesses"})`,
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
      buttonText: t(ctx.locale, "common.buttons.choose"),
    },
    { emoji: "🏪" },
  );

  await logStructuredEvent("SHOPS_TAGS_SHOWN", {
    wa_id: `***${ctx.from.slice(-4)}`,
    tag_count: activeTags.length,
  });

  return true;
}

export async function handleShopsTagSelection(
  ctx: RouterContext,
  state: { tags?: Array<{ id: string; slug: string; name: string; count: number }> },
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
      tag_slug: tag.slug,
      tag_name: tag.name,
    },
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "shops.location.prompt", { category: tag.name }),
    buildButtons(
      {
        id: IDS.BACK_MENU,
        title: t(ctx.locale, "common.buttons.cancel"),
      },
    ),
  );

  await logStructuredEvent("SHOPS_TAG_SELECTED", {
    wa_id: `***${ctx.from.slice(-4)}`,
    tag_slug: tag.slug,
  });

  return true;
}

export async function handleShopsLocation(
  ctx: RouterContext,
  state: { tag_slug?: string; tag_name?: string },
  location: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId || !state.tag_slug) return false;

  await logStructuredEvent("SHOPS_LOCATION_RECEIVED", {
    wa_id: `***${ctx.from.slice(-4)}`,
    tag_slug: state.tag_slug,
    lat: location.lat.toFixed(4),
    lng: location.lng.toFixed(4),
  });

  // Search for businesses by tag and location
  const { data: businesses, error } = await ctx.supabase
    .rpc("get_businesses_by_tag", {
      p_tag_slug: state.tag_slug,
      p_user_lat: location.lat,
      p_user_lon: location.lng,
      p_radius_km: 10,
      p_limit: 10,
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
      t(ctx.locale, "shops.search.no_results", { category: state.tag_name || state.tag_slug }),
      buildButtons(
        {
          id: "shops_browse_tags",
          title: t(ctx.locale, "shops.buttons.try_again"),
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
    key: "shops_results",
    data: {
      userLocation: location,
      tag_slug: state.tag_slug,
      tag_name: state.tag_name,
      businesses: businesses.map((biz: any) => ({
        id: biz.id,
        name: biz.name,
        description: biz.description,
        distance: biz.distance,
        whatsapp: biz.owner_whatsapp,
        location: biz.location_text,
      })),
    },
  });

  // Build list message with results
  const rows = businesses.slice(0, 10).map((biz: any, idx: number) => {
    const distance = biz.distance < 1
      ? `${Math.round(biz.distance * 1000)}m`
      : `${biz.distance.toFixed(1)}km`;

    return {
      id: `shop_result_${idx}`,
      title: biz.name || `Business #${idx + 1}`,
      description: `${biz.description || biz.location_text || "No description"} • ${distance} away`,
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
      title: t(ctx.locale, "shops.results.title", { category: state.tag_name || state.tag_slug }),
      body: t(ctx.locale, "shops.results.found", {
        count: businesses.length.toString(),
        category: state.tag_name || state.tag_slug,
      }),
      sectionTitle: t(ctx.locale, "shops.results.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.choose"),
    },
    { emoji: "🏪" },
  );

  await logStructuredEvent("SHOPS_RESULTS_SENT", {
    wa_id: `***${ctx.from.slice(-4)}`,
    tag_slug: state.tag_slug,
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
      distance?: number;
      whatsapp?: string;
      location?: string;
    }>;
    tag_name?: string;
  },
  selectionId: string,
): Promise<boolean> {
  if (!state.businesses) return false;

  const match = selectionId.match(/^shop_result_(\d+)$/);
  if (!match) return false;

  const idx = parseInt(match[1]);
  const business = state.businesses[idx];
  if (!business) return false;

  const distance = business.distance && business.distance < 1
    ? `${Math.round(business.distance * 1000)}m`
    : business.distance
    ? `${business.distance.toFixed(1)}km`
    : "Distance unknown";

  let message = `*${business.name}*\n\n`;
  if (business.description) message += `${business.description}\n\n`;
  if (business.location) message += `📍 ${business.location}\n`;
  message += `📏 ${distance} away\n`;
  if (business.whatsapp) message += `📞 WhatsApp: ${business.whatsapp}\n`;

  await sendButtonsMessage(
    ctx,
    message,
    buildButtons(
      {
        id: "shops_browse_tags",
        title: t(ctx.locale, "shops.buttons.search_again"),
      },
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
