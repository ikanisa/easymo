import type { RouterContext } from "../../types.ts";
import { setState, clearState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";
import { sendListMessage, sendButtonsMessage, buildButtons } from "../../utils/reply.ts";
import { t } from "../../i18n/translator.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { sendHomeMenu } from "../../flows/home.ts";

export const BUSINESS_MANAGEMENT_STATE = "business_management";
export const BUSINESS_DETAIL_STATE = "business_detail";
export const BUSINESS_DELETE_CONFIRM_STATE = "business_delete_confirm";

type BusinessListRow = {
  id: string;
  title: string;
  description: string;
};

type Business = {
  id: string;
  name: string;
  description: string | null;
  category_id: number | null;
  location_text: string | null;
  is_active: boolean;
};

/**
 * Display list of businesses owned by the current user
 */
export async function showManageBusinesses(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) {
    console.warn("business.no_profile_id", { from: ctx.from });
    return false;
  }

  await logStructuredEvent("BUSINESS_MANAGEMENT_SHOWN", {
    profileId: ctx.profileId,
    from: ctx.from,
  });

  // Query businesses owned by this user
  const { data: businesses, error } = await ctx.supabase
    .from("business")
    .select("id, name, description, category_id, location_text, is_active")
    .eq("owner_whatsapp", ctx.from)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("business.query_error", { error: error.message });
    await sendButtonsMessage(
      ctx,
      "⚠️ Could not load your businesses. Please try again later.",
      buildButtons({ id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") }),
    );
    return true;
  }

  if (!businesses || businesses.length === 0) {
    await setState(ctx.supabase, ctx.profileId, {
      key: BUSINESS_MANAGEMENT_STATE,
      data: {},
    });
    
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "business.list.none"),
      buildButtons(
        { id: IDS.PROFILE_ADD_BUSINESS, title: t(ctx.locale, "profile.rows.addBusiness.title") },
        { id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") },
      ),
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_MANAGEMENT_STATE,
    data: { businesses: businesses.map(b => b.id) },
  });

  const rows: BusinessListRow[] = businesses.map((business) => ({
    id: `biz::${business.id}`,
    title: business.name,
    description: business.location_text || business.description || "No description",
  }));

  rows.push({
    id: IDS.BACK_HOME,
    title: t(ctx.locale, "home.extras.back.title"),
    description: t(ctx.locale, "common.back_to_menu.description"),
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "business.list.title"),
      body: t(ctx.locale, "business.list.body"),
      sectionTitle: t(ctx.locale, "profile.menu.section"),
      rows,
      buttonText: t(ctx.locale, "common.buttons.select"),
    },
    { emoji: "🏪" },
  );

  return true;
}

/**
 * Show detail view for a specific business with management options
 */
export async function showBusinessDetail(
  ctx: RouterContext,
  businessId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Fetch business details
  const { data: business, error } = await ctx.supabase
    .from("business")
    .select("id, name, description, location_text, is_active, owner_whatsapp")
    .eq("id", businessId)
    .eq("owner_whatsapp", ctx.from)
    .single();

  if (error || !business) {
    console.error("business.detail_error", { error: error?.message, businessId });
    await sendButtonsMessage(
      ctx,
      "⚠️ Could not load business details.",
      buildButtons({ id: IDS.PROFILE_MANAGE_BUSINESSES, title: "← Back" }),
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_DETAIL_STATE,
    data: { businessId, businessName: business.name },
  });

  const rows: BusinessListRow[] = [
    {
      id: IDS.BUSINESS_EDIT,
      title: t(ctx.locale, "business.edit.title"),
      description: t(ctx.locale, "business.edit.description"),
    },
    {
      id: IDS.BUSINESS_ADD_WHATSAPP,
      title: t(ctx.locale, "business.addWhatsapp.title"),
      description: t(ctx.locale, "business.addWhatsapp.description"),
    },
    {
      id: IDS.BUSINESS_DELETE,
      title: t(ctx.locale, "business.delete.title"),
      description: t(ctx.locale, "business.delete.description"),
    },
    {
      id: IDS.PROFILE_MANAGE_BUSINESSES,
      title: "← Back to My Businesses",
      description: "Return to business list",
    },
  ];

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "business.detail.title", { name: business.name }),
      body: t(ctx.locale, "business.detail.body"),
      sectionTitle: "Options",
      rows,
      buttonText: t(ctx.locale, "common.buttons.select"),
    },
    { emoji: "🏪" },
  );

  return true;
}

/**
 * Handle business deletion with confirmation
 */
export async function handleBusinessDelete(
  ctx: RouterContext,
  businessId: string,
  businessName: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("BUSINESS_DELETE_REQUESTED", {
    profileId: ctx.profileId,
    businessId,
    from: ctx.from,
  });

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_DELETE_CONFIRM_STATE,
    data: { businessId, businessName },
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "business.delete.confirm", { name: businessName }),
    buildButtons(
      { id: IDS.BUSINESS_DELETE_CONFIRM, title: "🗑️ Yes, Delete" },
      { id: IDS.BACK_MENU, title: "Cancel" },
    ),
  );

  return true;
}

/**
 * Confirm and execute business deletion
 */
export async function confirmBusinessDelete(
  ctx: RouterContext,
  businessId: string,
  businessName: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Soft delete by setting is_active to false
  const { error } = await ctx.supabase
    .from("business")
    .update({ is_active: false })
    .eq("id", businessId)
    .eq("owner_whatsapp", ctx.from);

  if (error) {
    console.error("business.delete_error", { error: error.message, businessId });
    await sendButtonsMessage(
      ctx,
      "⚠️ Could not delete business. Please try again later.",
      buildButtons({ id: IDS.PROFILE_MANAGE_BUSINESSES, title: "← Back" }),
    );
    return true;
  }

  await logStructuredEvent("BUSINESS_DELETED", {
    profileId: ctx.profileId,
    businessId,
    businessName,
    from: ctx.from,
  });

  await clearState(ctx.supabase, ctx.profileId);

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "business.delete.success"),
    buildButtons(
      { id: IDS.PROFILE_MANAGE_BUSINESSES, title: "My Businesses" },
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") },
    ),
  );

  return true;
}

/**
 * Handle business selection from the list
 */
export async function handleBusinessSelection(
  ctx: RouterContext,
  id: string,
): Promise<boolean> {
  if (id.startsWith("biz::")) {
    const businessId = id.substring(5);
    return await showBusinessDetail(ctx, businessId);
  }
  return false;
}
