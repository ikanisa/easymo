import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendListMessage, sendButtonsMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export const BUSINESS_SEARCH_STATE = "business_search";
export const BUSINESS_CLAIM_STATE = "business_claim";

type SearchResult = {
  id: string;
  name: string;
  category_name: string | null;
  location_text: string | null;
  owner_whatsapp: string | null;
  owner_user_id: string | null;
  similarity_score: number;
  match_type: string;
};

/**
 * Start business search flow - prompt user to enter business name
 */
export async function startBusinessSearch(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_SEARCH_STATE,
    data: { step: "awaiting_name" },
  });

  await logStructuredEvent("BUSINESS_SEARCH_STARTED", {
    userId: ctx.profileId,
    from: ctx.from,
  });

  await sendButtonsMessage(
    ctx,
    "🔍 *Search for Your Business*\n\n" +
    "Please type the name of your business to search our directory of 3000+ businesses.\n\n" +
    "We'll help you claim it or add it manually if not found.",
    [
      { id: IDS.BUSINESS_ADD_MANUAL, title: "Add Manually" },
      { id: IDS.BACK_PROFILE, title: "← Cancel" },
    ],
  );

  return true;
}

/**
 * Handle business name search input from user
 */
export async function handleBusinessNameSearch(
  ctx: RouterContext,
  searchTerm: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Validate search term
  if (!searchTerm || searchTerm.trim().length < 2) {
    await sendText(
      ctx.from,
      "⚠️ Please enter at least 2 characters to search.\n\n" +
      "Type the name of your business:",
    );
    return true;
  }

  await logStructuredEvent("BUSINESS_SEARCH_QUERY", {
    userId: ctx.profileId,
    searchTerm,
    termLength: searchTerm.length,
  });

  // Get user's country for filtering
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("country")
    .eq("user_id", ctx.profileId)
    .single();

  const country = profile?.country || "RW";

  // Perform semantic search
  try {
    const { data: results, error } = await ctx.supabase.rpc(
      "search_businesses_semantic",
      {
        p_search_term: searchTerm,
        p_country: country,
        p_limit: 10,
      },
    );

    if (error) {
      await logStructuredEvent("BUSINESS_SEARCH_ERROR", {
        error: error.message,
        userId: ctx.profileId,
        searchTerm,
      }, "error");
      await sendButtonsMessage(
        ctx,
        "⚠️ Search failed. Please try again or add your business manually.",
        [
          { id: IDS.BUSINESS_ADD_MANUAL, title: "Add Manually" },
          { id: IDS.BACK_PROFILE, title: "← Cancel" },
        ],
      );
      return true;
    }

    if (!results || results.length === 0) {
      await logStructuredEvent("BUSINESS_SEARCH_NO_RESULTS", {
        userId: ctx.profileId,
        searchTerm,
      });

      await sendButtonsMessage(
        ctx,
        `🔍 *No businesses found for "${searchTerm}"*\n\n` +
        "Would you like to add it manually?",
        [
          { id: IDS.BUSINESS_ADD_MANUAL, title: "✅ Add Manually" },
          { id: IDS.BUSINESS_SEARCH, title: "🔄 Search Again" },
          { id: IDS.BACK_PROFILE, title: "← Cancel" },
        ],
      );
      return true;
    }

    await logStructuredEvent("BUSINESS_SEARCH_RESULTS", {
      userId: ctx.profileId,
      searchTerm,
      resultCount: results.length,
      topScore: results[0]?.similarity_score || 0,
    });

    // Show search results
    await showSearchResults(ctx, searchTerm, results as SearchResult[]);
    return true;
  } catch (err) {
    await logStructuredEvent("BUSINESS_SEARCH_EXCEPTION", {
      error: err instanceof Error ? err.message : String(err),
      userId: ctx.profileId,
    }, "error");
    await sendButtonsMessage(
      ctx,
      "⚠️ An error occurred. Please try again.",
      [{ id: IDS.BACK_PROFILE, title: "← Back" }],
    );
    return true;
  }
}

/**
 * Display search results as a list
 */
async function showSearchResults(
  ctx: RouterContext,
  searchTerm: string,
  results: SearchResult[],
): Promise<void> {
  if (!ctx.profileId) return;

  // Store results in state for claim confirmation
  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_SEARCH_STATE,
    data: {
      step: "showing_results",
      searchTerm,
      results: results.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category_name,
        location: r.location_text,
        score: r.similarity_score,
      })),
    },
  });

  const rows = results.map((result) => ({
    id: `claim::${result.id}`,
    title: result.name.substring(0, 24), // WhatsApp limit
    description: `${result.category_name || "Business"} • ${result.location_text || "Location TBD"} • ${Math.round(result.similarity_score * 100)}% match`,
  }));

  // Add action buttons
  rows.push(
    {
      id: IDS.BUSINESS_ADD_MANUAL,
      title: "➕ Add New Business",
      description: "Not in the list? Add manually",
    },
    {
      id: IDS.BUSINESS_SEARCH,
      title: "🔄 Search Again",
      description: "Try a different search term",
    },
    {
      id: IDS.BACK_PROFILE,
      title: "← Cancel",
      description: "Back to menu",
    },
  );

  await sendListMessage(
    ctx,
    {
      title: `🔍 Found ${results.length} businesses`,
      body: `Search results for "${searchTerm}":\n\nSelect your business to claim it, or add a new one if yours isn't listed.`,
      sectionTitle: "Search Results",
      rows,
      buttonText: "Select",
    },
    { emoji: "🏪" },
  );
}

/**
 * Handle business claim - user selects a business from search results
 */
export async function handleBusinessClaim(
  ctx: RouterContext,
  businessId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Fetch business details - use consistent table name (businesses) and column (profile_id)
  const { data: business, error } = await ctx.supabase
    .from("businesses")
    .select("id, name, category, address, profile_id")
    .eq("id", businessId)
    .single();

  if (error || !business) {
    await logStructuredEvent("BUSINESS_CLAIM_FETCH_ERROR", {
      error: error?.message,
      businessId,
      userId: ctx.profileId,
    }, "error");
    await sendButtonsMessage(
      ctx,
      "⚠️ Business not found. Please try searching again.",
      [{ id: IDS.BUSINESS_SEARCH, title: "Search Again" }],
    );
    return true;
  }

  // Check if already claimed
  if (business.profile_id && business.profile_id !== ctx.profileId) {
    await logStructuredEvent("BUSINESS_CLAIM_ALREADY_CLAIMED", {
      userId: ctx.profileId,
      businessId,
      existingOwnerId: business.profile_id,
    });

    await sendButtonsMessage(
      ctx,
      `⚠️ *${business.name}* is already claimed by another owner.\n\n` +
      "If you believe this is your business, please contact support.",
      [
        { id: IDS.BUSINESS_SEARCH, title: "Search Again" },
        { id: IDS.BACK_PROFILE, title: "← Back" },
      ],
    );
    return true;
  }

  // Store business details for confirmation
  await setState(ctx.supabase, ctx.profileId, {
    key: BUSINESS_CLAIM_STATE,
    data: {
      businessId,
      businessName: business.name,
      category: business.category,
      location: business.address,
    },
  });

  await logStructuredEvent("BUSINESS_CLAIM_INITIATED", {
    userId: ctx.profileId,
    businessId,
    businessName: business.name,
  });

  // Ask for confirmation
  const details = [
    `🏪 *${business.name}*`,
    business.category ? `📂 ${business.category}` : "",
    business.address ? `📍 ${business.address}` : "",
  ].filter(Boolean).join("\n");

  await sendButtonsMessage(
    ctx,
    `${details}\n\n*Claim this business?*\n\n` +
    "You'll be able to manage it from your profile.",
    [
      { id: IDS.BUSINESS_CLAIM_CONFIRM, title: "✅ Yes, Claim It" },
      { id: IDS.BUSINESS_SEARCH, title: "← Back to Search" },
      { id: IDS.BACK_PROFILE, title: "Cancel" },
    ],
  );

  return true;
}

/**
 * Confirm business claim and update ownership
 */
export async function confirmBusinessClaim(
  ctx: RouterContext,
  businessId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    // Update business ownership - use consistent column name (profile_id)
    const { error: updateError } = await ctx.supabase
      .from("businesses")
      .update({
        profile_id: ctx.profileId,
      })
      .eq("id", businessId);

    if (updateError) {
      await logStructuredEvent("BUSINESS_CLAIM_UPDATE_ERROR", {
        error: updateError.message,
        businessId,
        userId: ctx.profileId,
      }, "error");
      await sendButtonsMessage(
        ctx,
        "⚠️ Failed to claim business. Please try again.",
        [{ id: IDS.MY_BUSINESSES, title: "← My Businesses" }],
      );
      return true;
    }

    // Get business name for confirmation message
    const { data: business } = await ctx.supabase
      .from("businesses")
      .select("name, category")
      .eq("id", businessId)
      .single();

    await logStructuredEvent("BUSINESS_CLAIMED_SUCCESS", {
      userId: ctx.profileId,
      businessId,
      businessName: business?.name || "Unknown",
      method: "search_claim",
    });

    await clearState(ctx.supabase, ctx.profileId);

    await sendButtonsMessage(
      ctx,
      `✅ *Success!*\n\n` +
      `You've claimed *${business?.name || "this business"}*.\n\n` +
      `You can now manage it from your profile.`,
      [
        { id: IDS.MY_BUSINESSES, title: "View My Businesses" },
        { id: IDS.BACK_HOME, title: "← Home" },
      ],
    );

    return true;
  } catch (err) {
    await logStructuredEvent("BUSINESS_CLAIM_EXCEPTION", {
      error: err instanceof Error ? err.message : String(err),
      businessId,
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
