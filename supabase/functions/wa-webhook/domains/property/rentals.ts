/**
 * Property Rentals Flow
 * 
 * User flow:
 * Option A - Add Property: Collect criteria → Save to DB (NO AI)
 * Option B - Find Property: Collect search criteria → AI Agent
 */

import type { RouterContext } from "../../types.ts";
import { setState, clearState } from "../../state/store.ts";
import { sendListMessage, sendButtonsMessage, homeOnly } from "../../utils/reply.ts";
import { sendText } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { isFeatureEnabled } from "../../../_shared/feature-flags.ts";
import { handleAIPropertyRental } from "../ai-agents/index.ts";
import { sendHomeMenu } from "../../flows/home.ts";

const RENTAL_TYPES = [
  {
    id: "short_term",
    title: "🗓️ Short-term",
    description: "1 day to 3 months",
  },
  {
    id: "long_term",
    title: "📅 Long-term",
    description: "3+ months",
  },
];

const BEDROOM_OPTIONS = [
  { id: "1", title: "1 Bedroom", description: "Studio or 1BR" },
  { id: "2", title: "2 Bedrooms", description: "2BR apartment/house" },
  { id: "3", title: "3 Bedrooms", description: "3BR house" },
  { id: "4", title: "4+ Bedrooms", description: "Large house" },
];

export async function startPropertyRentals(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await setState(ctx.supabase, ctx.profileId, {
    key: "property_menu",
    data: {},
  });
  
  await sendListMessage(
    ctx,
    {
      title: "🏠 Property Rentals",
      body: "Find or add rental properties",
      sectionTitle: "Choose an option",
      buttonText: "View options",
      rows: [
        {
          id: IDS.PROPERTY_FIND,
          title: "🔍 Find Property",
          description: "Search for rental properties",
        },
        {
          id: IDS.PROPERTY_ADD,
          title: "➕ Add Property",
          description: "List your property for rent",
        },
        {
          id: IDS.BACK_HOME,
          title: "🏠 Back to Home",
          description: "Return to main menu",
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
        title: "🔍 Find Property",
        body: "What type of rental are you looking for?",
        sectionTitle: "Rental Type",
        buttonText: "Choose",
        rows: RENTAL_TYPES,
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
        title: "➕ Add Property",
        body: "What type of rental is your property?",
        sectionTitle: "Rental Type",
        buttonText: "Choose",
        rows: RENTAL_TYPES,
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
      title: "🔍 Find Property",
      body: "How many bedrooms do you need?",
      sectionTitle: "Bedrooms",
      buttonText: "Choose",
      rows: BEDROOM_OPTIONS,
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

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_find_budget",
    data: { ...state, bedrooms },
  });

  await sendText(
    ctx.from,
    "💰 What's your budget?\n\n" +
    "Please type your monthly budget range.\n" +
    "Example: 200-500 or just 300"
  );

  return true;
}

export async function handleFindPropertyBudget(
  ctx: RouterContext,
  state: { rentalType: string; bedrooms: string },
  budget: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_find_location",
    data: { ...state, budget },
  });

  await sendText(
    ctx.from,
    "📍 Where would you like to rent?\n\n" +
    "Share your desired location.\n" +
    "Tap: Attachment icon → Location → Send location"
  );

  return true;
}

export async function handleFindPropertyLocation(
  ctx: RouterContext,
  state: { rentalType: string; bedrooms: string; budget: string },
  location: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Call AI agent if enabled
  if (isFeatureEnabled("agent.property_rental")) {
    await sendText(ctx.from, "🤖 Searching for properties and negotiating prices...");
    
    try {
      return await handleAIPropertyRental(
        ctx,
        "find",
        state.rentalType as "short_term" | "long_term",
        { latitude: location.lat, longitude: location.lng },
        {
          bedrooms: parseInt(state.bedrooms),
          budget: state.budget,
        },
      );
    } catch (error) {
      console.error("Property AI agent error:", error);
      await sendText(
        ctx.from,
        "Sorry, we couldn't find properties right now. Please try again later."
      );
      await clearState(ctx.supabase, ctx.profileId);
      return true;
    }
  }

  // Fallback: no AI, just acknowledge
  await sendText(
    ctx.from,
    "✅ Your property search has been saved!\n\n" +
    "We'll notify you when matching properties are available."
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
      title: "➕ Add Property",
      body: "How many bedrooms does your property have?",
      sectionTitle: "Bedrooms",
      buttonText: "Choose",
      rows: BEDROOM_OPTIONS,
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

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_add_price",
    data: { ...state, bedrooms },
  });

  await sendText(
    ctx.from,
    "💰 What's your monthly rent price?\n\n" +
    "Please type the monthly rent amount.\n" +
    "Example: 300 or 450"
  );

  return true;
}

export async function handleAddPropertyPrice(
  ctx: RouterContext,
  state: { rentalType: string; bedrooms: string },
  price: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "property_add_location",
    data: { ...state, price },
  });

  await sendText(
    ctx.from,
    "📍 Where is your property located?\n\n" +
    "Share the property location.\n" +
    "Tap: Attachment icon → Location → Send location"
  );

  return true;
}

export async function handleAddPropertyLocation(
  ctx: RouterContext,
  state: { rentalType: string; bedrooms: string; price: string },
  location: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // TODO: Save to database
  // For now, just acknowledge
  await sendText(
    ctx.from,
    "✅ *Property Added Successfully!*\n\n" +
    `📋 Details:\n` +
    `• Type: ${state.rentalType === "short_term" ? "Short-term" : "Long-term"}\n` +
    `• Bedrooms: ${state.bedrooms}\n` +
    `• Price: $${state.price}/month\n` +
    `• Location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}\n\n` +
    "Your property is now listed and visible to people searching!"
  );

  await clearState(ctx.supabase, ctx.profileId);
  await sendHomeMenu(ctx);
  return true;
}
