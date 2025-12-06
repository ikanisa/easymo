import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendListMessage, sendButtonsMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export const BUSINESS_SEARCH_STATE = "business_search";
export const BUSINESS_CLAIM_STATE = "business_claim";

interface SearchResult {
  id: string;
  name: string;
  category_name: string | null;
  city: string | null;
  address: string | null;
  similarity_score: number;
  is_claimed: boolean;
}

export async function startBusinessSearch(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_SEARCH_STATE,
    data: { step: "awaiting_name" },
  });

  await sendButtonsMessage(
    ctx,
    "🔍 *Add Your Business*\n\n" +
    "Type the name of your business and I'll search our directory of 3,000+ businesses.\n\n" +
    "If your business is already listed, you can claim it. Otherwise, you can add it manually.",
    [{ id: IDS.BACK_PROFILE, title: "← Back" }]
  );

  return true;
}

export async function handleBusinessNameSearch(
  ctx: RouterContext,
  searchTerm: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await logStructuredEvent("BUSINESS_SEARCH_INITIATED", {
    userId: ctx.profileId,
    searchTerm,
  });

  const { data: results, error } = await ctx.supabase.rpc("search_businesses_semantic", {
    p_search_term: searchTerm,
    p_country: "Rwanda",
    p_limit: 8,
  });

  if (error) {
    console.error("business.search_error", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Search failed. Please try again.",
      [
        { id: IDS.BUSINESS_ADD_MANUAL, title: "➕ Add Manually" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ]
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_SEARCH_STATE,
    data: { 
      step: "showing_results",
      searchTerm,
      results: results || [],
    },
  });

  if (!results || results.length === 0) {
    return await showNoResultsFound(ctx, searchTerm);
  }

  return await showSearchResults(ctx, searchTerm, results);
}

async function showSearchResults(
  ctx: RouterContext,
  searchTerm: string,
  results: SearchResult[]
): Promise<boolean> {
  const rows = results.map((biz) => {
    const claimed = biz.is_claimed ? " (Claimed)" : "";
    return {
      id: `claim::${biz.id}`,
      title: biz.name.slice(0, 24),
      description: `${biz.category_name || "Business"} • ${biz.city || "Rwanda"}${claimed}`.slice(0, 72),
    };
  });

  rows.push({
    id: IDS.BUSINESS_ADD_MANUAL,
    title: "➕ Add New Business",
    description: `"${searchTerm}" not here? Add it manually`,
  });

  rows.push({
    id: IDS.BACK_PROFILE,
    title: "← Back to Profile",
    description: "Cancel search",
  });

  await sendListMessage(ctx, {
    title: "🔍 Search Results",
    body: `Found ${results.length} businesses matching "${searchTerm}":\n\nTap a business to claim it, or add yours manually.`,
    sectionTitle: "Businesses",
    buttonText: "Select",
    rows,
  });

  return true;
}

async function showNoResultsFound(
  ctx: RouterContext,
  searchTerm: string
): Promise<boolean> {
  await sendButtonsMessage(
    ctx,
    `🔍 *No Results Found*\n\nNo businesses found matching "${searchTerm}".\n\nWould you like to add your business manually?`,
    [
      { id: IDS.BUSINESS_ADD_MANUAL, title: "➕ Add Manually" },
      { id: IDS.BUSINESS_SEARCH, title: "🔍 Search Again" },
      { id: IDS.BACK_PROFILE, title: "← Back" },
    ]
  );

  return true;
}

export async function handleBusinessClaim(
  ctx: RouterContext,
  businessId: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { data: business, error } = await ctx.supabase
    .from("business")
    .select("id, name, category_name, city, address, phone, owner_user_id")
    .eq("id", businessId)
    .single();

  if (error || !business) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Business not found. Please try again.",
      [{ id: IDS.BUSINESS_SEARCH, title: "🔍 Search Again" }]
    );
    return true;
  }

  if (business.owner_user_id) {
    await sendButtonsMessage(
      ctx,
      `⚠️ *Business Already Claimed*\n\n"${business.name}" is already claimed by another user.\n\nIf you believe this is your business, please contact support.`,
      [
        { id: IDS.BUSINESS_SEARCH, title: "🔍 Search Again" },
        { id: IDS.BUSINESS_ADD_MANUAL, title: "➕ Add Different" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ]
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_CLAIM_STATE,
    data: { businessId, businessName: business.name },
  });

  await sendButtonsMessage(
    ctx,
    `🏪 *Claim Business*\n\n*${business.name}*\n📍 ${business.city || "Rwanda"}\n📂 ${business.category_name || "Business"}\n\nIs this your business? Claiming it will link it to your profile and allow you to manage it.`,
    [
      { id: IDS.BUSINESS_CLAIM_CONFIRM, title: "✅ Yes, Claim It" },
      { id: IDS.BUSINESS_SEARCH, title: "🔍 Search Again" },
      { id: IDS.BACK_PROFILE, title: "← Back" },
    ]
  );

  return true;
}

export async function confirmBusinessClaim(
  ctx: RouterContext,
  businessId: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const { error: updateError } = await ctx.supabase
    .from("business")
    .update({ 
      owner_user_id: ctx.profileId,
      owner_whatsapp: ctx.from,
    })
    .eq("id", businessId);

  if (updateError) {
    console.error("business.claim_error", updateError);
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to claim business. Please try again.",
      [{ id: IDS.BACK_PROFILE, title: "← Back" }]
    );
    return true;
  }

  await ctx.supabase.from("user_businesses").insert({
    user_id: ctx.profileId,
    business_id: businessId,
    role: "owner",
    verification_method: "whatsapp",
    is_verified: true,
    verified_at: new Date().toISOString(),
  });

  await logStructuredEvent("BUSINESS_CLAIMED", {
    userId: ctx.profileId,
    businessId,
    from: ctx.from,
  });

  await sendButtonsMessage(
    ctx,
    "✅ *Business Claimed Successfully!*\n\nYour business is now linked to your profile. You can manage it from your Profile menu.",
    [
      { id: IDS.PROFILE_MANAGE_BUSINESSES, title: "🏪 My Businesses" },
      { id: IDS.BACK_PROFILE, title: "← Back to Profile" },
    ]
  );

  return true;
}
