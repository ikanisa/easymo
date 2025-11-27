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
    .from("businesses")
    .select("id, name, category, status")
    .eq("owner_id", ctx.profileId)
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
    id: `BIZ::${b.id}`,
    title: b.name,
    description: `${b.category || "General"} • ${b.status || "Active"}`,
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
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .eq("owner_id", ctx.profileId)
    .single();

  if (error || !business) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Business not found or you don't have permission to view it.",
      [{ id: IDS.MY_BUSINESSES, title: "← Back to Businesses" }],
    );
    return true;
  }

  const details = [
    `*${business.name}*`,
    business.category ? `Category: ${business.category}` : null,
    business.description ? `\n${business.description}` : null,
    business.location ? `\n📍 ${business.location}` : null,
    business.phone_number ? `📞 ${business.phone_number}` : null,
    business.status ? `\nStatus: ${business.status}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await sendListMessage(
    ctx,
    {
      title: "🏪 Business Details",
      body: details,
      sectionTitle: "Actions",
      buttonText: "Choose",
      rows: [
        {
          id: `EDIT_BIZ::${businessId}`,
          title: "✏️ Edit",
          description: "Update business information",
        },
        {
          id: `DELETE_BIZ::${businessId}`,
          title: "🗑️ Delete",
          description: "Remove this business",
        },
        {
          id: IDS.MY_BUSINESSES,
          title: "← Back",
          description: "Return to businesses list",
        },
      ],
    },
    { emoji: "🏪" },
  );

  return true;
}
