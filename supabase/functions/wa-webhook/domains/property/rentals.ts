/**
 * Property Rentals Flow
 * 
 * User flow:
 * Option A - Add Property: Collect criteria → Save to DB (NO AI)
 * Option B - Find Property: Collect search criteria → AI Agent
 */

import type { RouterContext } from "../../types.ts";
import { setState, clearState } from "../../state/store.ts";
import {
  sendListMessage,
  sendButtonsMessage,
  buildButtons,
  homeOnly,
} from "../../utils/reply.ts";
import { sendText } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { isFeatureEnabled } from "../../../_shared/feature-flags.ts";
import { handleAIPropertyRental } from "../ai-agents/index.ts";
import { sendHomeMenu } from "../../flows/home.ts";
import { t } from "../../i18n/translator.ts";
import {
  describeCurrency,
  formatCurrencyFromInput,
  getCurrencyByCode,
  resolveUserCurrency,
} from "../../utils/currency.ts";
import {
  getFavoriteById,
  listFavorites,
  type UserFavorite,
} from "../locations/favorites.ts";
import { buildSaveRows } from "../locations/save.ts";

export type PropertyFindState = {
  rentalType: string;
  bedrooms: string;
  budget: string;
  currency?: string;
};

export type PropertyAddState = {
  rentalType: string;
  bedrooms: string;
  price: string;
  currency?: string;
};

export type PropertySavedPickerState =
  | {
    source: "property_find";
    state: PropertyFindState;
  }
  | {
    source: "property_add";
    state: PropertyAddState;
  };

function rentalTypeRows(locale: RouterContext["locale"]) {
  return [
    {
      id: "short_term",
      title: t(locale, "property.rental.short_term.title"),
      description: t(locale, "property.rental.short_term.description"),
    },
    {
      id: "long_term",
      title: t(locale, "property.rental.long_term.title"),
      description: t(locale, "property.rental.long_term.description"),
    },
  ];
}

function bedroomOptions(locale: RouterContext["locale"]) {
  return [
    {
      id: "1",
      title: t(locale, "property.bedrooms.option1.title"),
      description: t(locale, "property.bedrooms.option1.description"),
    },
    {
      id: "2",
      title: t(locale, "property.bedrooms.option2.title"),
      description: t(locale, "property.bedrooms.option2.description"),
    },
    {
      id: "3",
      title: t(locale, "property.bedrooms.option3.title"),
      description: t(locale, "property.bedrooms.option3.description"),
    },
    {
      id: "4",
      title: t(locale, "property.bedrooms.option4.title"),
      description: t(locale, "property.bedrooms.option4.description"),
    },
  ];
}

export async function startPropertyRentals(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await setState(ctx.supabase, ctx.profileId, {
    key: "property_menu",
    data: {},
  });
  
  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "property.menu.title"),
      body: t(ctx.locale, "property.menu.body"),
      sectionTitle: t(ctx.locale, "property.menu.section"),
      buttonText: t(ctx.locale, "property.menu.button"),
      rows: [
        {
          id: IDS.PROPERTY_FIND,
          title: t(ctx.locale, "property.menu.find.title"),
          description: t(ctx.locale, "property.menu.find.description"),
        },
        {
          id: IDS.PROPERTY_ADD,
          title: t(ctx.locale, "property.menu.add.title"),
          description: t(ctx.locale, "property.menu.add.description"),
        },
        {
          id: IDS.BACK_HOME,
          title: t(ctx.locale, "property.menu.back.title"),
          description: t(ctx.locale, "property.menu.back.description"),
        },
      ],
    },
    { emoji: "🏠" },
  );
  
  return true;
}

export async function handlePropertyMenuSelection(
  ctx: RouterContext,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  if (id === IDS.PROPERTY_FIND) {
    // Start Find Property flow
    await setState(ctx.supabase, ctx.profileId, {
      key: "property_find_type",
      data: {},
    });
    
    await sendListMessage(
      ctx,
      {
        title: t(ctx.locale, "property.find.title"),
        body: t(ctx.locale, "property.find.prompt.type"),
        sectionTitle: t(ctx.locale, "property.find.section.type"),
        buttonText: t(ctx.locale, "property.common.choose"),
        rows: rentalTypeRows(ctx.locale),
      },
      { emoji: "🏠" },
    );
    return true;
  }

  if (id === IDS.PROPERTY_ADD) {
    // Start Add Property flow
    await setState(ctx.supabase, ctx.profileId, {
      key: "property_add_type",
      data: {},
    });
    
    await sendListMessage(
      ctx,
      {
        title: t(ctx.locale, "property.add.title"),
        body: t(ctx.locale, "property.add.prompt.type"),
        sectionTitle: t(ctx.locale, "property.find.section.type"),
        buttonText: t(ctx.locale, "property.common.choose"),
        rows: rentalTypeRows(ctx.locale),
      },
      { emoji: "🏠" },
    );
    return true;
  }

  if (id === IDS.BACK_HOME) {
    await clearState(ctx.supabase, ctx.profileId);
    await sendHomeMenu(ctx);
    return true;
  }

  return false;
}

// Find Property Flow Handlers
export async function handleFindPropertyType(
  ctx: RouterContext,
  rentalType: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_find_bedrooms",
    data: { rentalType },
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "property.find.title"),
      body: t(ctx.locale, "property.find.prompt.bedrooms"),
      sectionTitle: t(ctx.locale, "property.find.section.bedrooms"),
      buttonText: t(ctx.locale, "property.common.choose"),
      rows: bedroomOptions(ctx.locale),
    },
    { emoji: "🏠" },
  );

  return true;
}

export async function handleFindPropertyBedrooms(
  ctx: RouterContext,
  state: { rentalType: string },
  bedrooms: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const currencyPref = resolveUserCurrency(ctx.from);

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_find_budget",
    data: { ...state, bedrooms, currency: currencyPref.code },
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "property.find.prompt.budget", {
      currency: describeCurrency(currencyPref),
      code: currencyPref.code,
    }),
    homeOnly(),
  );

  return true;
}

export async function handleFindPropertyBudget(
  ctx: RouterContext,
  state: { rentalType: string; bedrooms: string; currency?: string },
  budget: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const currencyCode = state.currency ?? resolveUserCurrency(ctx.from).code;

  const nextState: PropertyFindState = {
    rentalType: state.rentalType,
    bedrooms: state.bedrooms,
    budget,
    currency: currencyCode,
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_find_location",
    data: nextState,
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "property.find.prompt.location"),
    buildButtons(
      { id: "property_share_location", title: t(ctx.locale, "property.buttons.share_location") },
      { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") },
    ),
  );

  return true;
}

export async function handleFindPropertyLocation(
  ctx: RouterContext,
  state: PropertyFindState,
  location: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const currencyPref = state.currency
    ? getCurrencyByCode(state.currency)
    : resolveUserCurrency(ctx.from);

  // Call AI agent if enabled
  if (isFeatureEnabled("agent.property_rental")) {
    await sendText(ctx.from, t(ctx.locale, "property.find.searching"));
    
    try {
      return await handleAIPropertyRental(
        ctx,
        "find",
        state.rentalType as "short_term" | "long_term",
        { latitude: location.lat, longitude: location.lng },
        {
          bedrooms: parseInt(state.bedrooms),
          budget: state.budget,
          currency: currencyPref.code,
        },
      );
    } catch (error) {
      console.error("Property AI agent error:", error);
      await sendText(
        ctx.from,
        t(ctx.locale, "property.find.error"),
      );
      await clearState(ctx.supabase, ctx.profileId);
      return true;
    }
  }

  // Fallback: no AI, just acknowledge
  await sendText(
    ctx.from,
    t(ctx.locale, "property.find.success"),
  );
  await clearState(ctx.supabase, ctx.profileId);
  return true;
}

// Add Property Flow Handlers
export async function handleAddPropertyType(
  ctx: RouterContext,
  rentalType: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_add_bedrooms",
    data: { rentalType },
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "property.add.title"),
      body: t(ctx.locale, "property.add.prompt.bedrooms"),
      sectionTitle: t(ctx.locale, "property.find.section.bedrooms"),
      buttonText: t(ctx.locale, "property.common.choose"),
      rows: bedroomOptions(ctx.locale),
    },
    { emoji: "🏠" },
  );

  return true;
}

export async function handleAddPropertyBedrooms(
  ctx: RouterContext,
  state: { rentalType: string },
  bedrooms: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const currencyPref = resolveUserCurrency(ctx.from);

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_add_price",
    data: { ...state, bedrooms, currency: currencyPref.code },
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "property.add.prompt.price", {
      currency: describeCurrency(currencyPref),
      code: currencyPref.code,
    }),
    homeOnly(),
  );

  return true;
}

export async function handleAddPropertyPrice(
  ctx: RouterContext,
  state: { rentalType: string; bedrooms: string; currency?: string },
  price: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const currencyCode = state.currency ?? resolveUserCurrency(ctx.from).code;

  const nextState: PropertyAddState = {
    rentalType: state.rentalType,
    bedrooms: state.bedrooms,
    price,
    currency: currencyCode,
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_add_location",
    data: nextState,
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "property.add.prompt.location"),
    buildButtons(
      { id: "property_add_share_location", title: t(ctx.locale, "property.buttons.share_location") },
      { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") },
    ),
  );

  return true;
}

export async function handleAddPropertyLocation(
  ctx: RouterContext,
  state: PropertyAddState,
  location: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const currencyPref = state.currency
    ? getCurrencyByCode(state.currency)
    : resolveUserCurrency(ctx.from);
  const priceLabel = formatCurrencyFromInput(state.price, currencyPref);

  // TODO: Save to database
  await clearState(ctx.supabase, ctx.profileId);

  const rentalLabel = state.rentalType === "short_term"
    ? t(ctx.locale, "property.rental.short_term.title")
    : t(ctx.locale, "property.rental.long_term.title");
  const coordsLabel = `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
  
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "property.add.success", {
      type: rentalLabel,
      bedrooms: state.bedrooms,
      price: priceLabel,
      coords: coordsLabel,
    }),
    buildButtons(
      { id: IDS.PROPERTY_RENTALS, title: t(ctx.locale, "property.buttons.view_rentals") },
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") },
    ),
  );

  return true;
}

export async function startPropertySavedLocationPicker(
  ctx: RouterContext,
  mode: "find" | "add",
  state: PropertyFindState | PropertyAddState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const favorites = await listFavorites(ctx);
  await setState(ctx.supabase, ctx.profileId, {
    key: "location_saved_picker",
    data: {
      source: mode === "find" ? "property_find" : "property_add",
      state,
    } satisfies PropertySavedPickerState,
  });
  const baseBody = t(ctx.locale, "location.saved.list.body", {
    context: t(ctx.locale, "location.context.pickup"),
  });
  const body = favorites.length
    ? baseBody
    : `${baseBody}\n\n${t(ctx.locale, "location.saved.list.empty")}`;
  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "location.saved.list.title"),
      body,
      sectionTitle: t(ctx.locale, "location.saved.list.section"),
      rows: [
        ...favorites.map(propertyFavoriteToRow),
        ...buildSaveRows(ctx),
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
          description: t(ctx.locale, "common.back_to_menu.description"),
        },
      ],
      buttonText: t(ctx.locale, "location.saved.list.button"),
    },
    { emoji: "⭐" },
  );
  return true;
}

export async function handlePropertySavedLocationSelection(
  ctx: RouterContext,
  pickerState: PropertySavedPickerState,
  selectionId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const favorite = await getFavoriteById(ctx, selectionId);
  if (!favorite) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "location.saved.list.expired"),
      homeOnly(),
    );
    return true;
  }
  if (pickerState.source === "property_find") {
    return await handleFindPropertyLocation(
      ctx,
      pickerState.state,
      { lat: favorite.lat, lng: favorite.lng },
    );
  }
  return await handleAddPropertyLocation(
    ctx,
    pickerState.state,
    { lat: favorite.lat, lng: favorite.lng },
  );
}

function propertyFavoriteToRow(
  favorite: UserFavorite,
): { id: string; title: string; description?: string } {
  return {
    id: favorite.id,
    title: `⭐ ${favorite.label}`,
    description: favorite.address ??
      `${favorite.lat.toFixed(4)}, ${favorite.lng.toFixed(4)}`,
  };
}
