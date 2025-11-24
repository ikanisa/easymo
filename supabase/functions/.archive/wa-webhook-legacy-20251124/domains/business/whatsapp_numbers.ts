import type { RouterContext } from "../../types.ts";
import { setState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";
import { sendListMessage, sendButtonsMessage, buildButtons } from "../../utils/reply.ts";
import { t } from "../../i18n/translator.ts";
import { logStructuredEvent } from "../../observe/log.ts";

export const BUSINESS_WHATSAPP_NUMBERS_STATE = "business_whatsapp_numbers";
export const BUSINESS_ADD_WHATSAPP_STATE = "business_add_whatsapp";

type WhatsAppNumber = {
  id: string;
  whatsapp_e164: string;
  is_primary: boolean;
  verified: boolean;
  added_at: string;
};

/**
 * Display list of WhatsApp numbers for a business
 */
export async function showBusinessWhatsAppNumbers(
  ctx: RouterContext,
  businessId: string,
  businessName: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("BUSINESS_WHATSAPP_NUMBERS_VIEWED", {
    profileId: ctx.profileId,
    businessId,
    from: ctx.from,
  });

  // Query WhatsApp numbers for this business
  const { data: numbers, error } = await ctx.supabase
    .from("business_whatsapp_numbers")
    .select("id, whatsapp_e164, is_primary, verified, added_at")
    .eq("business_id", businessId)
    .order("is_primary", { ascending: false })
    .order("added_at", { ascending: true });

  if (error) {
    console.error("business.whatsapp_query_error", { error: error.message });
    await sendButtonsMessage(
      ctx,
      "⚠️ Could not load WhatsApp numbers. Please try again.",
      buildButtons({ id: IDS.BUSINESS_EDIT, title: "← Back" }),
    );
    return true;
  }

  const rows = (numbers || []).map((num) => {
    const masked = maskPhoneNumber(num.whatsapp_e164);
    const badge = num.is_primary ? "⭐ Primary" : num.verified ? "✓ Verified" : "";
    return {
      id: `whatsapp::${num.id}`,
      title: `${masked} ${badge}`,
      description: `Added ${formatDate(num.added_at)}`,
    };
  });

  rows.push({
    id: IDS.BUSINESS_ADD_WHATSAPP,
    title: "➕ Add New Number",
    description: "Add another WhatsApp contact number",
  });

  rows.push({
    id: `biz::${businessId}`,
    title: "← Back",
    description: "Return to business details",
  });

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_WHATSAPP_NUMBERS_STATE,
    data: { businessId, businessName },
  });

  await sendListMessage(
    ctx,
    {
      title: `📱 WhatsApp Numbers - ${businessName}`,
      body: `${numbers?.length || 0} contact number(s)`,
      sectionTitle: "Numbers",
      rows,
      buttonText: "Select",
    },
    { emoji: "📱" },
  );

  return true;
}

/**
 * Start the flow to add a new WhatsApp number
 */
export async function startAddWhatsAppNumber(
  ctx: RouterContext,
  businessId: string,
  businessName: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_ADD_WHATSAPP_STATE,
    data: { businessId, businessName },
  });

  await sendButtonsMessage(
    ctx,
    "📱 Send the WhatsApp number you want to add to this business.\n\nFormat: +250788123456 (include country code)",
    buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
  );

  return true;
}

/**
 * Handle text input for adding WhatsApp number
 */
export async function handleAddWhatsAppNumberText(
  ctx: RouterContext,
  text: string,
  businessId: string,
  businessName: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Validate WhatsApp number format (E.164)
  const cleaned = text.trim();
  const e164Regex = /^\+[1-9]\d{1,14}$/;

  if (!e164Regex.test(cleaned)) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Invalid format. Please use international format with country code.\n\nExample: +250788123456",
      buildButtons(
        { id: IDS.BUSINESS_ADD_WHATSAPP, title: "Try Again" },
        { id: IDS.BACK_MENU, title: "Cancel" },
      ),
    );
    return true;
  }

  // Check if number already exists for this business
  const { data: existing } = await ctx.supabase
    .from("business_whatsapp_numbers")
    .select("id")
    .eq("business_id", businessId)
    .eq("whatsapp_e164", cleaned)
    .maybeSingle();

  if (existing) {
    await sendButtonsMessage(
      ctx,
      "⚠️ This number is already added to this business.",
      buildButtons({ id: IDS.BUSINESS_ADD_WHATSAPP, title: "← Back to Numbers" }),
    );
    return true;
  }

  // Insert new number
  const { error } = await ctx.supabase
    .from("business_whatsapp_numbers")
    .insert({
      business_id: businessId,
      whatsapp_e164: cleaned,
      is_primary: false,
      verified: false,
      added_by_whatsapp: ctx.from,
    });

  if (error) {
    console.error("business.add_whatsapp_error", {
      error: error.message,
      businessId,
    });
    await sendButtonsMessage(
      ctx,
      "⚠️ Could not add number. Please try again later.",
      buildButtons({ id: IDS.BUSINESS_ADD_WHATSAPP, title: "← Back to Numbers" }),
    );
    return true;
  }

  await logStructuredEvent("BUSINESS_WHATSAPP_NUMBER_ADDED", {
    profileId: ctx.profileId,
    businessId,
    whatsappNumber: maskPhoneNumber(cleaned),
    from: ctx.from,
  });

  await sendButtonsMessage(
    ctx,
    `✅ WhatsApp number added successfully!\n\n${maskPhoneNumber(cleaned)}`,
    buildButtons({ id: IDS.BUSINESS_ADD_WHATSAPP, title: "View All Numbers" }),
  );

  return true;
}

/**
 * Handle selection of a specific WhatsApp number (for future edit/delete)
 */
export async function handleWhatsAppNumberSelection(
  ctx: RouterContext,
  numberId: string,
  businessId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // For now, just show a placeholder message
  // Future: Allow setting as primary, removing, etc.
  await sendButtonsMessage(
    ctx,
    "Number management options coming soon!\n\nYou can currently view and add numbers. Full management features (set primary, remove, verify) will be available in the next update.",
    buildButtons({ id: IDS.BUSINESS_ADD_WHATSAPP, title: "← Back to Numbers" }),
  );

  return true;
}

/**
 * Mask phone number for display (show only last 4 digits)
 */
function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 4) return phone;
  const last4 = phone.slice(-4);
  const masked = phone.slice(0, -4).replace(/\d/g, "*");
  return masked + last4;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
}
