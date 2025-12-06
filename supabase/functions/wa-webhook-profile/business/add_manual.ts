import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
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
    buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
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
    buildButtons(
      { id: "skip_description", title: "Skip →" },
      { id: IDS.BACK_MENU, title: "Cancel" },
    ),
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
