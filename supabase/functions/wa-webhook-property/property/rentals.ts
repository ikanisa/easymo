/**
 * Property Rentals Flow
 * 
 * User flow:
 * Option A - Add Property: Collect criteria → Save to DB (NO AI)
 * Option B - Find Property: Collect search criteria → AI Agent
 * 
 * RE-Fix 1: Now includes role handshake to identify buyer/tenant vs landlord vs agent
 */

import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import {
  sendListMessage,
  sendButtonsMessage,
  buildButtons,
  homeOnly,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { isFeatureEnabled } from "../../_shared/feature-flags.ts";
import { sendHomeMenu } from "../../_shared/wa-webhook-shared/flows/home.ts";
import { t } from "../../_shared/wa-webhook-shared/i18n/translator.ts";
import {
  describeCurrency,
  formatCurrencyFromInput,
  getCurrencyByCode,
  resolveUserCurrency,
} from "../../_shared/wa-webhook-shared/utils/currency.ts";
import {
  getFavoriteById,
  listFavorites,
  type UserFavorite,
} from "../../_shared/wa-webhook-shared/domains/locations/favorites.ts";
import { buildSaveRows } from "../../_shared/wa-webhook-shared/domains/locations/save.ts";
import { recordRecentActivity } from "../../_shared/wa-webhook-shared/domains/locations/recent.ts";
import { getRecentLocation } from "../../_shared/wa-webhook-shared/domains/locations/recent.ts";
import { cachePropertyLocation, resolvePropertyLocation } from "../handlers/location-handler.ts";
import { logStructuredEvent, recordMetric } from "../../_shared/observability.ts";
import {
  getRealEstateState,
  initializeRoleSelection,
  setUserRole,
  requiresRoleHandshake,
  formatRoleSelectionMessage,
  parseRoleFromButtonId,
} from "../../_shared/agents/real-estate/index.ts";

export type PropertyFindState = {
  rentalType: string;
  bedrooms: string;
  budget: string;
  currency?: string;
  duration?: string; // For short-term: number of days
};

export type PropertyAddState = {
  rentalType: string;
  bedrooms: string;
  price: string;
  currency?: string;
  duration?: string; // For short-term: number of days
  priceUnit?: string; // "per_day" | "per_night" | "per_month"
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

function priceUnitOptions(locale: RouterContext["locale"], rentalType: string) {
  if (rentalType === "short_term") {
    return [
      {
        id: "per_day",
        title: t(locale, "property.priceUnit.perDay.title"),
        description: t(locale, "property.priceUnit.perDay.description"),
      },
      {
        id: "per_night",
        title: t(locale, "property.priceUnit.perNight.title"),
        description: t(locale, "property.priceUnit.perNight.description"),
      },
    ];
  }
  return [
    {
      id: "per_month",
      title: t(locale, "property.priceUnit.perMonth.title"),
      description: t(locale, "property.priceUnit.perMonth.description"),
    },
  ];
}

export async function startPropertyRentals(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // RE-Fix 1: Check if role handshake is needed
  const reState = await getRealEstateState(ctx.supabase, ctx.profileId);
  
  if (requiresRoleHandshake(reState)) {
    // Initialize role selection and show role handshake
    await initializeRoleSelection(ctx.supabase, ctx.profileId, "whatsapp");
    
    await logStructuredEvent("REAL_ESTATE_ROLE_HANDSHAKE_STARTED", {
      userId: ctx.profileId,
      locale: ctx.locale,
    });
    
    recordMetric("real_estate.role_handshake", 1, { entry: "property_rentals" });
    
    const roleMsg = formatRoleSelectionMessage();
    
    await sendButtonsMessage(
      ctx,
      roleMsg.body,
      buildButtons(...roleMsg.buttons),
      { emoji: "🏠" }
    );
    
    return true;
  }
  
  // Role already known, proceed with normal menu
  await setState(ctx.supabase, ctx.profileId, {
    key: "property_menu",
    data: { role: reState?.data.role },
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
          id: IDS.PROPERTY_CHAT_AI,
          title: t(ctx.locale, "property.menu.chatAI.title"),
          description: t(ctx.locale, "property.menu.chatAI.description"),
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

/**
 * Handle role selection from role handshake
 * RE-Fix 1: Route based on selected role
 */
export async function handleRoleSelection(
  ctx: RouterContext,
  buttonId: string
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  const role = parseRoleFromButtonId(buttonId);
  
  if (!role) {
    return false;
  }
  
  await logStructuredEvent("REAL_ESTATE_ROLE_SELECTED", {
    userId: ctx.profileId,
    role,
    buttonId,
  });
  
  // Set the role and transition to appropriate state
  await setUserRole(ctx.supabase, ctx.profileId, role);
  
  // Route to appropriate flow based on role
  if (role === "buyer_tenant") {
    // Go to Find Property flow
    return await handlePropertyMenuSelection(ctx, IDS.PROPERTY_FIND);
  } else if (role === "landlord_owner") {
    // Go to Add Property flow
    return await handlePropertyMenuSelection(ctx, IDS.PROPERTY_ADD);
  } else if (role === "agency_staff") {
    // For agency staff, show agency management options or redirect to portal
    await sendButtonsMessage(
      ctx,
      "👔 *Welcome, Real Estate Agent!*\n\n" +
      "For full agency management features, please use our web portal.\n\n" +
      "Here you can:\n" +
      "• Add new listings for your clients\n" +
      "• Chat with our AI assistant\n\n" +
      "What would you like to do?",
      buildButtons(
        { id: IDS.PROPERTY_ADD, title: "➕ Add Listing" },
        { id: IDS.PROPERTY_CHAT_AI, title: "🤖 Chat with AI" },
        { id: IDS.BACK_HOME, title: "↩️ Main Menu" }
      ),
      { emoji: "🏢" }
    );
    return true;
  }
  
  return false;
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

  if (id === IDS.PROPERTY_CHAT_AI) {
    // Start AI Agent Chat
    await setState(ctx.supabase, ctx.profileId, {
      key: "property_ai_chat",
      data: { chatActive: true },
    });
    
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "property.aiChat.welcome"),
      buildButtons(
        { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
      ),
      { emoji: "🤖" }
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

  // For short-term rentals, ask for duration first
  if (state.rentalType === "short_term") {
    await setState(ctx.supabase, ctx.profileId, {
      key: "property_find_duration",
      data: { ...state, bedrooms },
    });

    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "property.find.prompt.duration"),
      homeOnly(),
    );

    return true;
  }

  // For long-term, go straight to budget
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

export async function handleFindPropertyDuration(
  ctx: RouterContext,
  state: { rentalType: string; bedrooms: string },
  duration: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const currencyPref = resolveUserCurrency(ctx.from);

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_find_budget",
    data: { ...state, duration, currency: currencyPref.code },
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
  state: { rentalType: string; bedrooms: string; currency?: string; duration?: string },
  budget: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const currencyCode = state.currency ?? resolveUserCurrency(ctx.from).code;

  const nextState: PropertyFindState = {
    rentalType: state.rentalType,
    bedrooms: state.bedrooms,
    budget,
    currency: currencyCode,
    duration: state.duration,
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_find_location",
    data: nextState,
  });

  // Record recent property search criteria
  try {
    await recordRecentActivity(ctx, 'property_search', undefined, nextState as unknown as Record<string, unknown>);
  } catch (_) { /* non-fatal */ }

  // Try standard 30-min location cache first (priority 1)
  try {
    const locationResult = await resolvePropertyLocation(ctx);
    if (locationResult.location) {
      return await handleFindPropertyLocation(ctx, nextState, locationResult.location);
    }
  } catch (_) { /* non-fatal - fall through to prompt */ }

  // Fallback: Recent-location skip from older cache
  try {
    const recent = await getRecentLocation(ctx, 'property');
    if (recent) {
      return await handleFindPropertyLocation(ctx, nextState, recent);
    }
  } catch (_) { /* non-fatal */ }

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "property.find.prompt.location", {
      instructions: t(ctx.locale, "location.share.instructions"),
    }),
    buildButtons(
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

  // Save location to cache (30-min TTL) for reuse by other services
  await cachePropertyLocation(ctx, location.lat, location.lng);

  // Call AI agent if enabled
  if (isFeatureEnabled("agent.property_rental")) {
    await sendText(ctx.from, t(ctx.locale, "property.find.searching"));
    
    try {
      // Call the property-rental agent edge function
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error("Missing Supabase credentials");
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-property-rental`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          userId: ctx.profileId,
          action: "find",
          rentalType: state.rentalType,
          location: { latitude: location.lat, longitude: location.lng },
          criteria: {
            bedrooms: parseInt(state.bedrooms),
            maxBudget: state.budget,
            currency: currencyPref.code,
          },
          userPhone: ctx.from,
          locale: ctx.locale,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI agent failed: ${response.statusText}`);
      }

      const aiResponse = await response.json();
      
      if (aiResponse.message) {
        await sendText(ctx.from, aiResponse.message);
      }

      await clearState(ctx.supabase, ctx.profileId);
      return true;

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

  // For short-term rentals, ask for price unit first
  if (state.rentalType === "short_term") {
    await setState(ctx.supabase, ctx.profileId, {
      key: "property_add_price_unit",
      data: { ...state, bedrooms },
    });

    await sendListMessage(
      ctx,
      {
        title: t(ctx.locale, "property.add.title"),
        body: t(ctx.locale, "property.add.prompt.priceUnit"),
        sectionTitle: t(ctx.locale, "property.add.section.priceUnit"),
        buttonText: t(ctx.locale, "property.common.choose"),
        rows: priceUnitOptions(ctx.locale, state.rentalType),
      },
      { emoji: "🏠" },
    );

    return true;
  }

  // For long-term, go straight to price (always per month)
  const currencyPref = resolveUserCurrency(ctx.from);

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_add_price",
    data: { ...state, bedrooms, currency: currencyPref.code, priceUnit: "per_month" },
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

export async function handleAddPropertyPriceUnit(
  ctx: RouterContext,
  state: { rentalType: string; bedrooms: string },
  priceUnit: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const currencyPref = resolveUserCurrency(ctx.from);

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_add_price",
    data: { ...state, priceUnit, currency: currencyPref.code },
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
  state: { rentalType: string; bedrooms: string; currency?: string; priceUnit?: string },
  price: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const currencyCode = state.currency ?? resolveUserCurrency(ctx.from).code;

  const nextState: PropertyAddState = {
    rentalType: state.rentalType,
    bedrooms: state.bedrooms,
    price,
    currency: currencyCode,
    priceUnit: state.priceUnit,
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_add_location",
    data: nextState,
  });

  // Record recent property posting criteria for resume
  try {
    await recordRecentActivity(ctx, 'property_add', undefined, nextState as unknown as Record<string, unknown>);
  } catch (_) { /* non-fatal */ }

  // Recent-location skip for add flow
  try {
    const recent = await getRecentLocation(ctx, 'property');
    if (recent) {
      return await handleAddPropertyLocation(ctx, nextState, recent);
    }
  } catch (_) { /* non-fatal */ }

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "property.add.prompt.location", {
      instructions: t(ctx.locale, "location.share.instructions"),
    }),
    buildButtons(
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

  // Save location to cache (30-min TTL) for reuse by other services
  await cachePropertyLocation(ctx, location.lat, location.lng);

  // Save to database
  try {
    const { error: saveError } = await ctx.supabase
      .from('property_rentals')
      .insert({
        user_id: ctx.profileId,
        rental_type: state.rentalType,
        bedrooms: parseInt(state.bedrooms),
        price: state.price,
        currency: state.currency || currencyPref.code,
        price_unit: state.priceUnit || 'per_month',
        latitude: location.lat,
        longitude: location.lng,
        contact_phone: ctx.from,
        status: 'active',
      });
    
    if (saveError) {
      console.error('property.save.error', saveError);
      // Continue even if save fails - user still gets response
    }
  } catch (error) {
    console.error('property.save.failed', error);
    // Continue even if save fails - user still gets response
  }
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
  if (mode === "find") {
    await setState(ctx.supabase, ctx.profileId, {
      key: "location_saved_picker",
      data: {
        source: "property_find",
        state: state as PropertyFindState,
      } satisfies PropertySavedPickerState,
    });
  } else {
    await setState(ctx.supabase, ctx.profileId, {
      key: "location_saved_picker",
      data: {
        source: "property_add",
        state: state as PropertyAddState,
      } satisfies PropertySavedPickerState,
    });
  }
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

/**
 * Handle conversational AI agent chat for property rentals
 */
export async function handlePropertyAIChat(
  ctx: RouterContext,
  userMessage: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing Supabase credentials");
    }

    // Show typing indicator
    await sendText(ctx.from, t(ctx.locale, "property.aiChat.processing"));

    // Call the property AI agent with conversational mode
    const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-property-rental`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        userId: ctx.profileId,
        mode: "conversational",
        message: userMessage,
        userPhone: ctx.from,
        locale: ctx.locale,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Property AI chat error:", response.status, errorText);
      
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "property.aiChat.error"),
        buildButtons(
          { id: IDS.PROPERTY_RENTALS, title: t(ctx.locale, "property.buttons.back_menu") },
          { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
        ),
      );
      return true;
    }

    const aiResponse = await response.json();

    // Send AI response to user
    if (aiResponse.message) {
      await sendButtonsMessage(
        ctx,
        aiResponse.message,
        buildButtons(
          { id: IDS.PROPERTY_RENTALS, title: t(ctx.locale, "property.buttons.back_menu") },
          { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
        ),
        { emoji: "🤖" }
      );
    }

    // If agent provides property options, display them
    if (aiResponse.properties && aiResponse.properties.length > 0) {
      const propertyRows = aiResponse.properties.slice(0, 9).map((prop: any, idx: number) => ({
        id: `ai_property_${idx}`,
        title: prop.title || `Property ${idx + 1}`,
        description: prop.description || `${prop.bedrooms} bed • ${prop.price}`,
      }));

      await sendListMessage(
        ctx,
        {
          title: t(ctx.locale, "property.aiChat.results.title"),
          body: t(ctx.locale, "property.aiChat.results.body", { count: aiResponse.properties.length }),
          sectionTitle: t(ctx.locale, "property.aiChat.results.section"),
          buttonText: t(ctx.locale, "property.common.choose"),
          rows: [
            ...propertyRows,
            {
              id: IDS.BACK_HOME,
              title: t(ctx.locale, "common.menu_back"),
              description: t(ctx.locale, "common.back_to_menu.description"),
            },
          ],
        },
        { emoji: "🏠" },
      );
    }

    return true;
  } catch (error) {
    console.error("Property AI chat exception:", error);
    
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "property.aiChat.error"),
      buildButtons(
        { id: IDS.PROPERTY_RENTALS, title: t(ctx.locale, "property.buttons.back_menu") },
        { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
      ),
    );
    
    return true;
  }
}
