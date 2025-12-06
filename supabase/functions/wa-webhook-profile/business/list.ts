import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import {
  sendButtonsMessage,
  sendListMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";

export async function listMyBusinesses(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: businesses, error } = await ctx.supabase
    .from("business")
    .select("id, name, category_name, location_text, is_active, bar_id, tag")
    .eq("owner_user_id", ctx.profileId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to fetch businesses:", error);
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
      "🏪 *You don't have any businesses yet.*\n\nTap the button below to chat with our Business Broker AI Agent who will help you register your business through a simple conversation.",
      [
        { id: IDS.BUSINESS_BROKER_AGENT, title: "💬 Chat with Business Agent" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ],
    );
    return true;
  }

  const rows = businesses.map((b) => ({
    id: `biz::${b.id}`,
    title: b.name,
    description: b.location_text || b.category_name || "Business",
  }));

  rows.push(
    {
      id: IDS.BUSINESS_BROKER_AGENT,
      title: "💬 Add via AI Agent",
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
      body: `You have ${businesses.length} business${businesses.length === 1 ? "" : "es"}`,
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
    .from("business")
    .select("*")
    .eq("id", businessId)
    .eq("owner_user_id", ctx.profileId)
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

  // Forward to main webhook's business detail handler
  const { showBusinessDetail } = await import(
    "../../wa-webhook/domains/business/management.ts"
  );
  
  return await showBusinessDetail(ctx, businessId);
}
