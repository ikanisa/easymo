import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendButtonsMessage, sendListMessage, sendText } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export const BUSINESS_ADD_MANUAL_STATE = "business_add_manual";

interface ManualBusinessData {
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

export async function startManualBusinessAdd(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_ADD_MANUAL_STATE,
    data: { step: "name" } as ManualBusinessData,
  });

  await sendButtonsMessage(
    ctx,
    "➕ *Add New Business*\n\nLet's add your business step by step.\n\n*Step 1/4: Business Name*\nPlease type the name of your business:",
    [{ id: IDS.BACK_PROFILE, title: "← Cancel" }]
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
  });

  await sendButtonsMessage(
    ctx,
    `✅ Business Name: *${name}*\n\n*Step 2/4: Short Description*\nDescribe what your business offers (e.g., "Best coffee in Kigali"):\n\n_Or tap Skip to continue_`,
    [
      { id: "skip_description", title: "⏭️ Skip" },
      { id: IDS.BACK_PROFILE, title: "← Cancel" },
    ]
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
  });

  await sendButtonsMessage(
    ctx,
    `📋 *Review Your Business*\n\n🏪 *${state.name}*\n${state.description ? `📝 ${state.description}\n` : ""}📂 ${category.name}\n\n*Ready to add this business?*`,
    [
      { id: IDS.BUSINESS_ADD_CONFIRM, title: "✅ Add Business" },
      { id: IDS.BUSINESS_ADD_MANUAL, title: "🔄 Start Over" },
      { id: IDS.BACK_PROFILE, title: "← Cancel" },
    ]
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
  );

  return true;
}
