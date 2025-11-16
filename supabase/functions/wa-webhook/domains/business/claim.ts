import type { RouterContext } from "../../types.ts";
import { t } from "../../i18n/translator.ts";
import { sendText } from "../../wa/client.ts";
import { sendButtonsMessage, sendListMessage, homeOnly } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { setState, clearState } from "../../state/store.ts";
import { logStructuredEvent } from "../../observe/log.ts";

/**
 * Business Claiming Flow with OpenAI Semantic Search
 * 
 * Flow:
 * 1. User taps "Add Business" under Profile
 * 2. System prompts: "Type the business name as it appears on Google Maps"
 * 3. User types business name
 * 4. System uses OpenAI to do semantic search in database
 * 5. System shows top 9 matching businesses in list view
 * 6. User selects one
 * 7. System claims business:
 *    - Updates owner_id with user's UUID
 *    - Adds user's WhatsApp to business_whatsapp_numbers
 * 8. User can now manage the business
 */

export type BusinessClaimState = {
  stage: "awaiting_name" | "search_results" | "claiming";
  searchQuery?: string;
  results?: Array<{
    id: string;
    name: string;
    category: string;
    address?: string;
    distance?: number;
  }>;
};

const BUSINESS_RESULT_PREFIX = "CLAIM_BIZ::";

/**
 * Start business claiming flow
 */
export async function startBusinessClaim(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "business_claim",
    data: {
      stage: "awaiting_name",
    } as BusinessClaimState,
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "business.claim.prompt_name"),
    [
      { id: IDS.BACK_MENU, title: t(ctx.locale, "common.buttons.cancel") },
    ],
  );

  await logStructuredEvent("BUSINESS_CLAIM_STARTED", {
    profile_id: ctx.profileId,
    wa_id: ctx.from,
  });

  return true;
}

/**
 * Handle business name search with OpenAI semantic search
 */
export async function handleBusinessNameSearch(
  ctx: RouterContext,
  businessName: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const trimmed = businessName.trim();
  if (trimmed.length < 2) {
    await sendText(ctx.from, t(ctx.locale, "business.claim.name_too_short"));
    return true;
  }

  await sendText(ctx.from, t(ctx.locale, "business.claim.searching"));

  try {
    // Perform OpenAI-powered semantic search
    const results = await searchBusinessesSemantic(ctx, trimmed);

    if (!results || results.length === 0) {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "business.claim.no_results", { query: trimmed }),
        [
          { id: IDS.PROFILE_ADD_BUSINESS, title: t(ctx.locale, "business.claim.search_again") },
          { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
        ],
      );
      return true;
    }

    // Store results in state
    await setState(ctx.supabase, ctx.profileId, {
      key: "business_claim",
      data: {
        stage: "search_results",
        searchQuery: trimmed,
        results: results.slice(0, 9),
      } as BusinessClaimState,
    });

    // Show results in list view
    await sendListMessage(
      ctx,
      {
        title: t(ctx.locale, "business.claim.results.title"),
        body: t(ctx.locale, "business.claim.results.body", { 
          count: results.length.toString(),
          query: trimmed,
        }),
        sectionTitle: t(ctx.locale, "business.claim.results.section"),
        rows: [
          ...results.slice(0, 9).map((biz, idx) => ({
            id: `${BUSINESS_RESULT_PREFIX}${idx}`,
            title: `🏢 ${biz.name}`,
            description: formatBusinessDescription(biz),
          })),
          {
            id: IDS.PROFILE_ADD_BUSINESS,
            title: t(ctx.locale, "business.claim.search_again"),
            description: t(ctx.locale, "business.claim.search_again.description"),
          },
          {
            id: IDS.BACK_MENU,
            title: t(ctx.locale, "common.menu_back"),
            description: t(ctx.locale, "common.back_to_menu.description"),
          },
        ],
        buttonText: t(ctx.locale, "common.buttons.choose"),
      },
      { emoji: "🏢" },
    );

    await logStructuredEvent("BUSINESS_CLAIM_SEARCH_RESULTS", {
      profile_id: ctx.profileId,
      query: trimmed,
      results_count: results.length,
    });

    return true;
  } catch (error) {
    console.error("business.claim.search_error", error);
    
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "business.claim.search_error"),
      [
        { id: IDS.PROFILE_ADD_BUSINESS, title: t(ctx.locale, "business.claim.try_again") },
        { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
      ],
    );

    return true;
  }
}

/**
 * Handle business selection and claiming
 */
export async function handleBusinessClaim(
  ctx: RouterContext,
  state: BusinessClaimState,
  selectionId: string,
): Promise<boolean> {
  if (!ctx.profileId || !state.results) return false;

  const match = selectionId.match(/^CLAIM_BIZ::(\d+)$/);
  if (!match) return false;

  const idx = parseInt(match[1]);
  const business = state.results[idx];
  if (!business) return false;

  await sendText(ctx.from, t(ctx.locale, "business.claim.processing"));

  try {
    // Check if business already claimed by this user
    // Check if user already owns this business
    const { data: existing } = await ctx.supabase
      .from("business")
      .select("id")
      .eq("id", business.id)
      .eq("owner_user_id", ctx.profileId)
      .maybeSingle();

    if (existing) {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "business.claim.already_claimed", { name: business.name }),
        homeOnly(),
      );
      await clearState(ctx.supabase, ctx.profileId);
      return true;
    }

    // Check if business is claimed by someone else
    const { data: otherOwner } = await ctx.supabase
      .from("business")
      .select("id, owner_user_id")
      .eq("id", business.id)
      .not("owner_user_id", "is", null)
      .maybeSingle();

    if (otherOwner && otherOwner.owner_user_id !== ctx.profileId) {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "business.claim.already_owned", { name: business.name }),
        homeOnly(),
      );
      await clearState(ctx.supabase, ctx.profileId);
      return true;
    }

    // Claim the business
    await claimBusiness(ctx, business.id);

    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "business.claim.success", {
        name: business.name,
        category: business.category || "business",
      }),
      [
        { id: IDS.PROFILE_BUSINESSES, title: t(ctx.locale, "business.claim.view_my_businesses") },
        { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
      ],
    );

    await logStructuredEvent("BUSINESS_CLAIMED", {
      profile_id: ctx.profileId,
      business_id: business.id,
      business_name: business.name,
      wa_id: ctx.from,
    });

    await clearState(ctx.supabase, ctx.profileId);
    return true;
  } catch (error) {
    console.error("business.claim.error", error);
    
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "business.claim.error"),
      homeOnly(),
    );

    await clearState(ctx.supabase, ctx.profileId);
    return true;
  }
}

/**
 * OpenAI-powered semantic business search
 * Uses embeddings and smart matching to find businesses
 */
async function searchBusinessesSemantic(
  ctx: RouterContext,
  query: string,
): Promise<Array<{
  id: string;
  name: string;
  category: string;
  address?: string;
  distance?: number;
}>> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    console.warn("business.claim.no_openai_key - falling back to simple search");
    return await searchBusinessesSimple(ctx, query);
  }

  try {
    // Step 1: Generate embedding for search query
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI embedding failed: ${embeddingResponse.statusText}`);
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData.data || embeddingData.data.length === 0) {
      throw new Error('No embedding data returned from OpenAI');
    }
    const queryEmbedding = embeddingData.data[0].embedding;

    // Step 2: Use OpenAI to extract search intent and keywords
    const intentResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a business search assistant. Extract key search terms and variations from user queries.
Output format: { "keywords": ["term1", "term2"], "category_hints": ["category1"], "location_hints": ["location"] }`,
          },
          {
            role: "user",
            content: `Extract search terms from: "${query}"`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!intentResponse.ok) {
      throw new Error(`OpenAI intent extraction failed: ${intentResponse.statusText}`);
    }

    const intentData = await intentResponse.json();
    const searchIntent = JSON.parse(intentData.choices[0].message.content);

    // Step 3: Search database with semantic matching
    const keywords = searchIntent.keywords || [query];
    const searchPattern = keywords.join("|");

    const { data: businesses, error } = await ctx.supabase
      .from("business")
      .select("id, name, category, address, google_maps_url, latitude, longitude")
      .or(`name.ilike.%${query}%,name.ilike.%${keywords[0]}%,category.ilike.%${searchIntent.category_hints?.[0] || ""}%`)
      .limit(20);

    if (error) throw error;

    if (!businesses || businesses.length === 0) {
      return await searchBusinessesSimple(ctx, query);
    }

    // Step 4: Use OpenAI to rank results by relevance
    const rankingResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a search ranking assistant. Rank businesses by relevance to the search query.
Output format: { "ranked_ids": ["id1", "id2", "id3"] } - Return IDs in order of relevance.`,
          },
          {
            role: "user",
            content: `Query: "${query}"
Businesses: ${JSON.stringify(businesses.map(b => ({ id: b.id, name: b.name, category: b.category })))}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!rankingResponse.ok) {
      // Fallback: return businesses as-is
      return businesses.map(b => ({
        id: b.id,
        name: b.name,
        category: b.category || "Business",
        address: b.address || undefined,
      }));
    }

    const rankingData = await rankingResponse.json();
    const ranking = JSON.parse(rankingData.choices[0].message.content);

    // Reorder businesses by AI ranking
    const rankedBusinesses = ranking.ranked_ids
      .map((id: string) => businesses.find(b => b.id === id))
      .filter((b: any) => b !== undefined)
      .map((b: any) => ({
        id: b.id,
        name: b.name,
        category: b.category || "Business",
        address: b.address || undefined,
      }));

    await logStructuredEvent("BUSINESS_SEARCH_SEMANTIC", {
      query,
      results_count: rankedBusinesses.length,
      method: "openai_semantic",
    });

    return rankedBusinesses;
  } catch (error) {
    console.error("business.search.semantic_error", error);
    return await searchBusinessesSimple(ctx, query);
  }
}

/**
 * Simple fallback search (no OpenAI)
 */
async function searchBusinessesSimple(
  ctx: RouterContext,
  query: string,
): Promise<Array<{
  id: string;
  name: string;
  category: string;
  address?: string;
}>> {
  const { data: businesses, error } = await ctx.supabase
    .from("business")
    .select("id, name, category, address")
    .ilike("name", `%${query}%`)
    .limit(9);

  if (error) {
    console.error("business.search.simple_error", error);
    return [];
  }

  await logStructuredEvent("BUSINESS_SEARCH_SIMPLE", {
    query,
    results_count: businesses?.length || 0,
    method: "simple_ilike",
  });

  return businesses?.map(b => ({
    id: b.id,
    name: b.name,
    category: b.category || "Business",
    address: b.address || undefined,
  })) || [];
}

/**
 * Claim a business for the user
 */
async function claimBusiness(
  ctx: RouterContext,
  businessId: string,
): Promise<void> {
  if (!ctx.profileId) throw new Error("No profile ID");

  // 1. Update business owner_user_id
  const { error: ownerError } = await ctx.supabase
    .from("business")
    .update({
      owner_user_id: ctx.profileId,
      owner_whatsapp: ctx.from,
    })
    .eq("id", businessId);

  if (ownerError) throw ownerError;

  // 2. Add user's WhatsApp to business_whatsapp_numbers
  const { error: whatsappError } = await ctx.supabase
    .from("business_whatsapp_numbers")
    .insert({
      business_id: businessId,
      whatsapp_number: ctx.from,
      is_primary: true,
      is_active: true,
      added_by: ctx.profileId,
    });

  if (whatsappError) {
    // Ignore if already exists
    if (!whatsappError.message.includes("duplicate")) {
      console.error("business.claim.whatsapp_error", whatsappError);
    }
  }

  // 3. Update business owner_id (legacy field)
  await ctx.supabase
    .from("business")
    .update({ owner_id: ctx.profileId })
    .eq("id", businessId);

  // 4. Add to profile_assets for easy tracking
  await ctx.supabase
    .from("profile_assets")
    .insert({
      profile_id: ctx.profileId,
      kind: "business",
      reference_id: businessId,
    });
}

/**
 * Format business description for list display
 */
function formatBusinessDescription(business: {
  category: string;
  address?: string;
  distance?: number;
}): string {
  const parts: string[] = [];

  if (business.category) {
    parts.push(business.category);
  }

  if (business.address) {
    parts.push(business.address);
  }

  if (business.distance !== undefined) {
    const distanceStr = business.distance < 1
      ? `${Math.round(business.distance * 1000)}m away`
      : `${business.distance.toFixed(1)}km away`;
    parts.push(distanceStr);
  }

  return parts.join(" • ") || "Business";
}
