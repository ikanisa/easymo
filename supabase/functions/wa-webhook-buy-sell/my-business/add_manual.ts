import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  clearState,
  setState,
} from "../../_shared/wa-webhook-shared/state/store.ts";
import {
  sendButtonsMessage,
  sendListMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export const BUSINESS_ADD_MANUAL_STATE = "business_add_manual";

type ManualAddState = {
  step: "name" | "description" | "category" | "location" | "confirm";
  name?: string;
  description?: string;
  category?: string;
  categoryId?: number;
  location?: string;
  latitude?: number;
  longitude?: number;
};

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

/**
 * Start manual business addition workflow
 */
export async function startManualBusinessAdd(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_ADD_MANUAL_STATE,
    data: { step: "name" } as ManualAddState,
  });

  await logStructuredEvent("BUSINESS_ADD_MANUAL_STARTED", {
    userId: ctx.profileId,
    from: ctx.from,
  });

  await sendButtonsMessage(
    ctx,
    "🏪 *Add Your Business*\n\n" +
      "Let's get your business set up! I'll guide you through a few quick steps.\n\n" +
      "*Step 1 of 4: Business Name*\n\n" +
      "Please type your business name:",
    [{ id: IDS.BACK_PROFILE, title: "← Cancel" }],
  );

  return true;
}

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
    `✅ Business name: *${name.trim()}*\n\n` +
      "*Step 2 of 4: Description (Optional)*\n\n" +
      "Provide a brief description of your business, or type 'skip' to continue:",
    [
      { id: "skip_description", title: "Skip →" },
      { id: IDS.BACK_PROFILE, title: "← Cancel" },
    ],
  );

  return true;
}

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

  // Show category selection list
  const rows = BUSINESS_CATEGORIES.map((cat) => ({
    id: `cat::${cat.slug}`,
    title: cat.name,
    description: `Select ${cat.name}`,
  }));

  rows.push({
    id: IDS.BACK_PROFILE,
    title: "← Cancel",
    description: "Cancel and go back",
  });

  await sendListMessage(ctx, {
    title: "📂 Select Category",
    body:
      `${
        description.toLowerCase() === "skip" ? "" : `✅ Description saved\n\n`
      }` +
      "*Step 3 of 4: Category*\n\n" +
      "Select the category that best describes your business:",
    sectionTitle: "Categories",
    buttonText: "Select Category",
    rows,
  });

  return true;
}

/**
 * Step 3: Category
 */
async function handleCategoryStep(
  ctx: RouterContext,
  state: ManualAddState,
  categoryInput: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Handle category selection from list (cat::slug format)
  const slug = categoryInput.replace("cat::", "");
  const category = BUSINESS_CATEGORIES.find((c) => c.slug === slug);

  if (!category) {
    await sendText(
      ctx.from,
      "⚠️ Please select a valid category from the list.",
    );
    return true;
  }

  const updatedState: ManualAddState = {
    ...state,
    category: category.name,
    categoryId: category.id,
    step: "location",
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_ADD_MANUAL_STATE,
    data: updatedState,
  });

  await sendButtonsMessage(
    ctx,
    `✅ Category: *${category.name}*\n\n` +
      "*Step 4 of 4: Location*\n\n" +
      "Share your business location:\n" +
      "• Send a location pin 📍, or\n" +
      "• Type the address",
    [
      { id: "skip_location", title: "Skip →" },
      { id: IDS.BACK_PROFILE, title: "← Cancel" },
    ],
  );

  return true;
}

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
    [
      { id: IDS.BUSINESS_ADD_CONFIRM, title: "✅ Create Business" },
      { id: IDS.BACK_PROFILE, title: "← Cancel" },
    ],
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
    [
      { id: IDS.BUSINESS_ADD_CONFIRM, title: "✅ Create Business" },
      { id: IDS.BACK_PROFILE, title: "← Cancel" },
    ],
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
    await sendText(
      ctx.from,
      "⚠️ Missing required information. Please start over.",
    );
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

    // Create business using consistent table name (businesses) and column (profile_id)
    const { data: newBusiness, error: insertError } = await ctx.supabase
      .from("businesses")
      .insert({
        name: state.name,
        description: state.description || null,
        category: state.category,
        address: state.location || null,
        profile_id: ctx.profileId,
        country,
        status: "active",
      })
      .select("id, name")
      .single();

    if (insertError || !newBusiness) {
      await logStructuredEvent("BUSINESS_ADD_MANUAL_INSERT_ERROR", {
        error: insertError?.message,
        userId: ctx.profileId,
        category: state.category,
      }, "error");
      await sendButtonsMessage(
        ctx,
        "⚠️ Failed to create business. Please try again later.",
        [{ id: IDS.MY_BUSINESSES, title: "← My Businesses" }],
      );
      return true;
    }

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
      [
        { id: IDS.MY_BUSINESSES, title: "View My Businesses" },
        { id: IDS.BACK_HOME, title: "← Home" },
      ],
    );

    return true;
  } catch (err) {
    await logStructuredEvent("BUSINESS_ADD_MANUAL_EXCEPTION", {
      error: err instanceof Error ? err.message : String(err),
      userId: ctx.profileId,
    }, "error");
    await sendButtonsMessage(
      ctx,
      "⚠️ An error occurred. Please try again later.",
      [{ id: IDS.BACK_PROFILE, title: "← Back" }],
    );
    return true;
  }
}
