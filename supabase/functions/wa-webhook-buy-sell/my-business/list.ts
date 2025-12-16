import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendListMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export async function listMyBusinesses(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: businesses, error } = await ctx.supabase
    .from("businesses")
    .select("id, name, category, address, status")
    .eq("profile_id", ctx.profileId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    await logStructuredEvent("BUSINESS_LIST_FETCH_ERROR", {
      error: error.message,
      profileId: ctx.profileId,
    }, "error");
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to load your businesses. Please try again.",
      [{ id: IDS.BACK_PROFILE, title: "← Back" }],
    );
    return true;
  }

  if (!businesses || businesses.length === 0) {
    await sendButtonsMessage(
      ctx,
      "🏪 *You don't have any businesses yet.*\n\nTap the button below to chat with our Buy & Sell AI Agent who will help you register your business through a simple conversation.",
      [
        { id: "buy_sell", title: "💬 Chat with Buy & Sell AI" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ],
    );
    return true;
  }

  const rows = businesses.map((b) => ({
    id: `BIZ::${b.id}`,
    title: b.name,
    description: b.address || b.category || "Business",
  }));

  rows.push(
    {
      id: "buy_sell",
      title: "💬 Add via Buy & Sell AI",
      description: "Chat with AI to register new business",
    },
    {
      id: IDS.BACK_PROFILE,
      title: "← Back to Profile",
      description: "Return to profile menu",
    },
  );

  await sendListMessage(
    ctx,
    {
      title: "🏪 My Businesses",
      body: `You have ${businesses.length} business${
        businesses.length === 1 ? "" : "es"
      }`,
      sectionTitle: "Businesses",
      buttonText: "View",
      rows,
    },
    { emoji: "🏪" },
  );

  return true;
}

export async function startCreateBusiness(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "business_create_name",
    data: {},
  });

  await sendButtonsMessage(
    ctx,
    "🏪 *Create New Business*\n\nWhat's the name of your business?",
    [{ id: IDS.BACK_BUSINESSES, title: "← Cancel" }],
  );

  return true;
}

export async function handleBusinessSelection(
  ctx: RouterContext,
  businessId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: business, error } = await ctx.supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .eq("profile_id", ctx.profileId)
    .single();

  if (error || !business) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Business not found or you don't have permission to view it.",
      [{ id: IDS.MY_BUSINESSES, title: "← Back to Businesses" }],
    );
    return true;
  }

  // ⚡ CRITICAL: Store bar_id in state for menu management
  await setState(ctx.supabase, ctx.profileId, {
    key: "business_detail",
    data: {
      businessId: business.id,
      barId: business.bar_id || null,
      businessName: business.name,
    },
  });

  // Business detail view - show business info and management options
  let detailMessage = `📋 *${business.name}*\n\n`;

  if (business.category) {
    detailMessage += `📂 Category: ${business.category}\n`;
  }
  if (business.address) {
    detailMessage += `📍 Address: ${business.address}\n`;
  }
  if (business.phone_number) {
    detailMessage += `📱 Phone: ${business.phone_number}\n`;
  }
  if (business.description) {
    detailMessage += `\n📝 ${business.description}\n`;
  }

  detailMessage += `\nWhat would you like to do?`;

  await sendButtonsMessage(
    ctx,
    detailMessage,
    [
      { id: `EDIT_BIZ::${business.id}`, title: "✏️ Edit Business" },
      { id: `DELETE_BIZ::${business.id}`, title: "🗑️ Delete Business" },
      { id: IDS.MY_BUSINESSES, title: "← Back to My Businesses" },
    ],
  );

  return true;
}
