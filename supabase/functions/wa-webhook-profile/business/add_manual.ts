import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendButtonsMessage, sendListMessage, sendText } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export const BUSINESS_ADD_MANUAL_STATE = "business_add_manual";

interface ManualBusinessData {
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { sendButtonsMessage, buildButtons } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { t } from "../../_shared/wa-webhook-shared/i18n/translator.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export const BUSINESS_ADD_MANUAL_STATE = "business_add_manual";

type ManualAddState = {
  step: "name" | "description" | "category" | "location" | "confirm";
  name?: string;
  description?: string;
  category?: string;
  categoryId?: number;
  lat?: number;
  lng?: number;
  locationText?: string;
}

const BUSINESS_CATEGORIES = [
  { id: 1, name: "Restaurant", slug: "restaurant" },
  { id: 2, name: "Bar & Restaurant", slug: "bar_restaurant" },
  { id: 3, name: "Cafe", slug: "cafe" },
  { id: 4, name: "Shop/Retail", slug: "shop" },
  { id: 5, name: "Salon & Beauty", slug: "salon" },
  { id: 6, name: "Hotel & Lodging", slug: "hotel" },
  { id: 7, name: "Pharmacy", slug: "pharmacy" },
  { id: 8, name: "Supermarket", slug: "supermarket" },
  { id: 9, name: "Electronics", slug: "electronics" },
  { id: 10, name: "Other", slug: "other" },
];

  location?: string;
  latitude?: number;
  longitude?: number;
};

/**
 * Start manual business addition workflow
 */
export async function startManualBusinessAdd(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_ADD_MANUAL_STATE,
    data: { step: "name" } as ManualBusinessData,
    data: { step: "name" } as ManualAddState,
  });

  await logStructuredEvent("BUSINESS_ADD_MANUAL_STARTED", {
    userId: ctx.profileId,
    from: ctx.from,
  });

  await sendButtonsMessage(
    ctx,
    "➕ *Add New Business*\n\nLet's add your business step by step.\n\n*Step 1/4: Business Name*\nPlease type the name of your business:",
    [{ id: IDS.BACK_PROFILE, title: "← Cancel" }]
    "🏪 *Add Your Business*\n\n" +
    "Let's get your business set up! I'll guide you through a few quick steps.\n\n" +
    "*Step 1 of 4: Business Name*\n\n" +
    "Please type your business name:",
    buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
  );

  return true;
}

export async function handleManualBusinessStep(
  ctx: RouterContext,
  state: ManualBusinessData,
  input: string | { lat: number; lng: number }
): Promise<boolean> {
  if (!ctx.profileId) return false;

  switch (state.step) {
    case "name":
      return await handleNameStep(ctx, state, input as string);
    case "description":
      return await handleDescriptionStep(ctx, state, input as string);
    case "category":
      return await handleCategoryStep(ctx, state, input as string);
/**
 * Handle each step of the manual business addition flow
 */
export async function handleManualBusinessStep(
  ctx: RouterContext,
  state: ManualAddState,
  input: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const currentStep = state.step;

  switch (currentStep) {
    case "name":
      return await handleNameStep(ctx, state, input);
    case "description":
      return await handleDescriptionStep(ctx, state, input);
    case "category":
      return await handleCategoryStep(ctx, state, input);
    case "location":
      return await handleLocationStep(ctx, state, input);
    case "confirm":
      return await handleConfirmStep(ctx, state);
    default:
      return false;
  }
}

async function handleNameStep(
  ctx: RouterContext,
  state: ManualBusinessData,
  name: string
): Promise<boolean> {
  if (!name || name.length < 2) {
    await sendText(ctx.from, "Please enter a valid business name (at least 2 characters).");
    return true;
  }

  await setState(ctx.supabase, ctx.profileId!, {
    key: BUSINESS_ADD_MANUAL_STATE,
    data: { ...state, step: "description", name },
/**
 * Step 1: Business Name
 */
async function handleNameStep(
  ctx: RouterContext,
  state: ManualAddState,
  name: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  if (!name || name.trim().length < 2) {
    await sendText(
      ctx.from,
      "⚠️ Business name is too short. Please enter at least 2 characters.",
    );
    return true;
  }

  const updatedState: ManualAddState = {
    ...state,
    name: name.trim(),
    step: "description",
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_ADD_MANUAL_STATE,
    data: updatedState,
  });

  await sendButtonsMessage(
    ctx,
    `✅ Business Name: *${name}*\n\n*Step 2/4: Short Description*\nDescribe what your business offers (e.g., "Best coffee in Kigali"):\n\n_Or tap Skip to continue_`,
    [
      { id: "skip_description", title: "⏭️ Skip" },
      { id: IDS.BACK_PROFILE, title: "← Cancel" },
    ]
    `✅ Business name: *${name.trim()}*\n\n` +
    "*Step 2 of 4: Description (Optional)*\n\n" +
    "Provide a brief description of your business, or type 'skip' to continue:",
    buildButtons(
      { id: "skip_description", title: "Skip →" },
      { id: IDS.BACK_MENU, title: "Cancel" },
    ),
  );

  return true;
}

async function handleDescriptionStep(
  ctx: RouterContext,
  state: ManualBusinessData,
  description: string
): Promise<boolean> {
  const desc = description === "skip_description" ? null : description;

  await setState(ctx.supabase, ctx.profileId!, {
    key: BUSINESS_ADD_MANUAL_STATE,
    data: { ...state, step: "category", description: desc || undefined },
  });

  const rows = BUSINESS_CATEGORIES.map((cat) => ({
    id: `cat::${cat.slug}`,
    title: cat.name,
    description: `Select ${cat.name}`,
  }));

  await sendListMessage(ctx, {
    title: "📂 Select Category",
    body: `✅ Business: *${state.name}*\n${desc ? `📝 ${desc}\n` : ""}\n*Step 3/4: Category*\nSelect the category that best describes your business:`,
    sectionTitle: "Categories",
    buttonText: "Select Category",
    rows,
  });
/**
 * Step 2: Description
 */
async function handleDescriptionStep(
  ctx: RouterContext,
  state: ManualAddState,
  description: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const updatedState: ManualAddState = {
    ...state,
    description: description.toLowerCase() === "skip" ? "" : description.trim(),
    step: "category",
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_ADD_MANUAL_STATE,
    data: updatedState,
  });

  await sendButtonsMessage(
    ctx,
    `${description.toLowerCase() === "skip" ? "" : `✅ Description saved\n\n`}` +
    "*Step 3 of 4: Category*\n\n" +
    "What type of business is this? (e.g., Bar, Restaurant, Shop, Pharmacy, etc.)\n\n" +
    "Type your category:",
    buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
  );

  return true;
}

async function handleCategoryStep(
  ctx: RouterContext,
  state: ManualBusinessData,
  categorySlug: string
): Promise<boolean> {
  const slug = categorySlug.replace("cat::", "");
  const category = BUSINESS_CATEGORIES.find((c) => c.slug === slug);

  if (!category) {
    await sendText(ctx.from, "Please select a valid category.");
    return true;
  }

  await setState(ctx.supabase, ctx.profileId!, {
    key: BUSINESS_ADD_MANUAL_STATE,
    data: { 
      ...state, 
      step: "confirm",  // Skip location for now, go straight to confirm
      category: category.name,
      categoryId: category.id,
    },
/**
 * Step 3: Category
 */
async function handleCategoryStep(
  ctx: RouterContext,
  state: ManualAddState,
  category: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  if (!category || category.trim().length < 2) {
    await sendText(
      ctx.from,
      "⚠️ Please enter a valid category (e.g., Bar, Restaurant, Shop).",
    );
    return true;
  }

  const updatedState: ManualAddState = {
    ...state,
    category: category.trim(),
    step: "location",
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_ADD_MANUAL_STATE,
    data: updatedState,
  });

  await sendButtonsMessage(
    ctx,
    `📋 *Review Your Business*\n\n🏪 *${state.name}*\n${state.description ? `📝 ${state.description}\n` : ""}📂 ${category.name}\n\n*Ready to add this business?*`,
    [
      { id: IDS.BUSINESS_ADD_CONFIRM, title: "✅ Add Business" },
      { id: IDS.BUSINESS_ADD_MANUAL, title: "🔄 Start Over" },
      { id: IDS.BACK_PROFILE, title: "← Cancel" },
    ]
    `✅ Category: *${category.trim()}*\n\n` +
    "*Step 4 of 4: Location*\n\n" +
    "Share your business location:\n" +
    "• Send a location pin 📍, or\n" +
    "• Type the address",
    buildButtons(
      { id: "skip_location", title: "Skip →" },
      { id: IDS.BACK_MENU, title: "Cancel" },
    ),
  );

  return true;
}

async function handleLocationStep(
  ctx: RouterContext,
  state: ManualBusinessData,
  input: string | { lat: number; lng: number }
): Promise<boolean> {
  // Simplified - skip location for now
  return await handleConfirmStep(ctx, state);
}

async function handleConfirmStep(
  ctx: RouterContext,
  state: ManualBusinessData
): Promise<boolean> {
  const { data: business, error } = await ctx.supabase
    .from("business")
    .insert({
      name: state.name,
      description: state.description,
      category_name: state.category,
      owner_user_id: ctx.profileId,
      owner_whatsapp: ctx.from,
      location_text: state.locationText,
      lat: state.lat,
      lng: state.lng,
      is_active: true,
      source: "user_generated",
      country: "Rwanda",
    })
    .select("id")
    .single();

  if (error) {
    console.error("business.create_error", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to create business. Please try again.",
      [{ id: IDS.BACK_PROFILE, title: "← Back" }]
    );
    return true;
  }

  await ctx.supabase.from("user_businesses").insert({
    user_id: ctx.profileId,
    business_id: business.id,
    role: "owner",
    verification_method: "self_registration",
    is_verified: true,
    verified_at: new Date().toISOString(),
  });

  await clearState(ctx.supabase, ctx.profileId!);

  await logStructuredEvent("BUSINESS_CREATED_MANUAL", {
    userId: ctx.profileId,
    businessId: business.id,
    businessName: state.name,
    category: state.category,
  });

  await sendButtonsMessage(
    ctx,
    `✅ *Business Added Successfully!*\n\n*${state.name}* is now listed and linked to your profile.\n\nYou can manage it from your Profile menu.`,
    [
      { id: IDS.PROFILE_MANAGE_BUSINESSES, title: "🏪 My Businesses" },
      { id: IDS.BACK_PROFILE, title: "← Back to Profile" },
    ]
/**
 * Step 4: Location
 */
async function handleLocationStep(
  ctx: RouterContext,
  state: ManualAddState,
  location: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const updatedState: ManualAddState = {
    ...state,
    location: location.toLowerCase() === "skip" ? "" : location.trim(),
    step: "confirm",
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_ADD_MANUAL_STATE,
    data: updatedState,
  });

  // Show confirmation
  const summary = [
    "📋 *Review Your Business*\n",
    `🏪 *Name:* ${state.name}`,
    state.description ? `📝 *Description:* ${state.description}` : "",
    `📂 *Category:* ${state.category}`,
    updatedState.location ? `📍 *Location:* ${updatedState.location}` : "",
  ].filter(Boolean).join("\n");

  await sendButtonsMessage(
    ctx,
    `${summary}\n\nEverything look good?`,
    buildButtons(
      { id: IDS.BUSINESS_ADD_MANUAL_CONFIRM, title: "✅ Create Business" },
      { id: IDS.BACK_MENU, title: "Cancel" },
    ),
  );

  return true;
}

/**
 * Handle location shared as GPS coordinates
 */
export async function handleLocationShared(
  ctx: RouterContext,
  state: ManualAddState,
  latitude: number,
  longitude: number,
  locationName?: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const updatedState: ManualAddState = {
    ...state,
    location: locationName || `${latitude}, ${longitude}`,
    latitude,
    longitude,
    step: "confirm",
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_ADD_MANUAL_STATE,
    data: updatedState,
  });

  // Show confirmation
  const summary = [
    "📋 *Review Your Business*\n",
    `🏪 *Name:* ${state.name}`,
    state.description ? `📝 *Description:* ${state.description}` : "",
    `📂 *Category:* ${state.category}`,
    `📍 *Location:* ${locationName || "GPS coordinates saved"}`,
  ].filter(Boolean).join("\n");

  await sendButtonsMessage(
    ctx,
    `${summary}\n\nEverything look good?`,
    buildButtons(
      { id: IDS.BUSINESS_ADD_MANUAL_CONFIRM, title: "✅ Create Business" },
      { id: IDS.BACK_MENU, title: "Cancel" },
    ),
  );

  return true;
}

/**
 * Step 5: Confirm and create business
 */
async function handleConfirmStep(
  ctx: RouterContext,
  state: ManualAddState,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  if (!state.name || !state.category) {
    await sendText(ctx.from, "⚠️ Missing required information. Please start over.");
    await clearState(ctx.supabase, ctx.profileId);
    return true;
  }

  try {
    // Get user's country
    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("country")
      .eq("user_id", ctx.profileId)
      .single();

    const country = profile?.country || "RW";

    // Create business
    const { data: newBusiness, error: insertError } = await ctx.supabase
      .from("business")
      .insert({
        name: state.name,
        description: state.description || null,
        category_name: state.category,
        location_text: state.location || null,
        latitude: state.latitude || null,
        longitude: state.longitude || null,
        owner_user_id: ctx.profileId,
        owner_whatsapp: ctx.from,
        country,
        is_active: true,
      })
      .select("id, name")
      .single();

    if (insertError || !newBusiness) {
      console.error("business_add_manual.insert_error", insertError);
      await sendButtonsMessage(
        ctx,
        "⚠️ Failed to create business. Please try again later.",
        buildButtons({ id: IDS.MY_BUSINESSES, title: "My Businesses" }),
      );
      return true;
    }

    // Create user_businesses record
    await ctx.supabase
      .from("user_businesses")
      .insert({
        user_id: ctx.profileId,
        business_id: newBusiness.id,
        role: "owner",
        is_verified: true,
        verification_method: "manual_add",
      });

    await logStructuredEvent("BUSINESS_ADDED_MANUALLY", {
      userId: ctx.profileId,
      businessId: newBusiness.id,
      businessName: newBusiness.name,
      category: state.category,
      hasLocation: !!state.location,
    });

    await clearState(ctx.supabase, ctx.profileId);

    await sendButtonsMessage(
      ctx,
      `🎉 *Success!*\n\n` +
      `Your business *${newBusiness.name}* has been created!\n\n` +
      `You can now manage it from your profile.`,
      buildButtons(
        { id: IDS.MY_BUSINESSES, title: "View My Businesses" },
        { id: IDS.BACK_HOME, title: "Home" },
      ),
    );

    return true;
  } catch (err) {
    console.error("business_add_manual.exception", err);
    await sendButtonsMessage(
      ctx,
      "⚠️ An error occurred. Please try again later.",
      buildButtons({ id: IDS.BACK_MENU, title: "Back" }),
    );
    return true;
  }
}
