import type { RouterContext } from "../../types.ts";
import { t } from "../../i18n/translator.ts";
import { sendText } from "../../wa/client.ts";
import { sendButtonsMessage, sendListMessage, homeOnly } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { setState, clearState } from "../../state/store.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { requireFirstMessageContent } from "../../../_shared/openaiGuard.ts";

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
    id: string; // can be 'bar:<uuid>' for bars table results
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
    // Perform fuzzy/semantic search via DB RPC with robust fallbacks
    const results = await searchBusinessesSmart(ctx, trimmed);

    if (!results || results.length === 0) {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "business.claim.no_results", { query: trimmed }),
        [
          { id: 'BIZ::ADD_NEW', title: '➕ Add new business' },
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
          ...results.slice(0, 8).map((biz, idx) => ({
            id: `${BUSINESS_RESULT_PREFIX}${idx}`,
            title: `🏢 ${biz.name}`,
            description: formatBusinessDescription(biz),
          })),
          {
            id: 'BIZ::ADD_NEW',
            title: '➕ Add new business',
            description: 'Enter name, share GPS location (WhatsApp pin), then choose category',
          },
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
    let claimedBarId: string | null = null;
    // If the selected entry came from bars table, convert it into a business record first
    if (business.id.startsWith('bar:')) {
      const barId = business.id.slice(4);
      const created = await createBusinessFromBar(ctx, barId, business.name, business.address, business.category);
      // Replace id with the newly created business id so the rest of the flow continues normally
      (state.results as any)[idx].id = created.businessId;
      business.id = created.businessId;
      claimedBarId = created.barId ?? barId;
    }

    // Load current claim/owner state
    let { data: existing, error: existingErr } = await ctx.supabase
      .from("business")
      .select("id, claimed, owner_user_id, bar_id")
      .eq("id", business.id)
      .maybeSingle();
    if (existingErr) throw existingErr;

    // Already claimed by this user
    if (!claimedBarId && existing?.bar_id) {
      claimedBarId = String(existing.bar_id);
    }

    if (existing && existing.claimed && existing.owner_user_id === ctx.profileId) {
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "business.claim.already_claimed", { name: business.name }),
        homeOnly(),
      );
      await clearState(ctx.supabase, ctx.profileId);
      return true;
    }

    // Claimed by someone else
    if (existing && existing.claimed && existing.owner_user_id && existing.owner_user_id !== ctx.profileId) {
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
    if (claimedBarId) {
      await ensureBarManager(ctx, claimedBarId);
    }

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
    const queryEmbedding = requireEmbedding(
      embeddingData,
      "Business search embedding",
    );

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
    const searchIntent = JSON.parse(
      requireFirstMessageContent(intentData, "Business intent extraction"),
    );

    // Step 3: Search database with semantic matching
    const keywords = searchIntent.keywords || [query];
    const searchPattern = keywords.join("|");

    const { data: businesses, error } = await ctx.supabase
      .from("business")
      .select("id, name, category, address, google_maps_url, latitude, longitude")
      .eq('claimed', false)
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
    const ranking = JSON.parse(
      requireFirstMessageContent(rankingData, "Business ranking"),
    );

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
    .select("id, name, category, category_name, address, location_text")
    .eq('claimed', false)
    .or([
      `name.ilike.%${query}%`,
      `category.ilike.%${query}%`,
      `category_name.ilike.%${query}%`,
      `address.ilike.%${query}%`,
      `location_text.ilike.%${query}%`,
    ].join(','))
    .limit(20);

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
    category: b.category_name || b.category || "Business",
    address: b.location_text || b.address || undefined,
  })) || [];
}

/**
 * Fuzzy/semantic business search (fast path)
 */
async function searchBusinessesSmart(
  ctx: RouterContext,
  query: string,
): Promise<Array<{
  id: string; name: string; category: string; address?: string; distance?: number;
}>> {
  try {
    const { data: fuzzy, error: fuzzyErr } = await ctx.supabase
      .rpc('search_businesses_fuzzy', { p_query: query, p_limit: 20 });
    if (!fuzzyErr && Array.isArray(fuzzy) && fuzzy.length) {
      await logStructuredEvent("BUSINESS_SEARCH_FUZZY", {
        query,
        results_count: fuzzy.length,
        method: "rpc_fuzzy",
      });
      // Filter out claimed via secondary lookup
      const ids = fuzzy.map((b: any) => b.id).filter(Boolean);
      let allowed = new Set<string>();
      if (ids.length) {
        const { data: unclaimed } = await ctx.supabase
          .from('business')
          .select('id')
          .in('id', ids)
          .eq('claimed', false);
        allowed = new Set((unclaimed || []).map((r: any) => r.id));
      }
      return fuzzy
        .filter((b: any) => allowed.has(b.id))
        .map((b: any) => ({
          id: b.id,
          name: b.name,
          category: b.category || "Business",
          address: b.address || undefined,
        }));
    }

    const { data: broad, error: broadErr } = await ctx.supabase
      .from("business")
      .select("id, name, category, category_name, location_text, address")
      .eq('claimed', false)
      .or([
        `name.ilike.%${query}%`,
        `category.ilike.%${query}%`,
        `category_name.ilike.%${query}%`,
        `location_text.ilike.%${query}%`,
        `address.ilike.%${query}%`,
      ].join(','))
      .limit(20);
    if (!broadErr && Array.isArray(broad) && broad.length) {
      await logStructuredEvent("BUSINESS_SEARCH_BROAD", {
        query,
        results_count: broad.length,
        method: "broad_ilike",
      });
      const bizList = broad.map((b: any) => ({
        id: b.id,
        name: b.name,
        category: b.category_name || b.category || "Business",
        address: b.location_text || b.address || undefined,
      }));
      // Complement with bars matches (name/location) if space remains
      const remaining = Math.max(0, 20 - bizList.length);
      let barsList: any[] = [];
      if (remaining > 0) {
        const { data: bars } = await ctx.supabase
          .from('bars')
          .select('id, name, location_text')
          .eq('claimed', false)
          .or([
            `name.ilike.%${query}%`,
            `location_text.ilike.%${query}%`,
          ].join(','))
          .limit(remaining);
        if (Array.isArray(bars) && bars.length) {
          barsList = bars.map((r: any) => ({
            id: `bar:${r.id}`,
            name: r.name,
            category: 'Bar & Restaurant',
            address: r.location_text || undefined,
          }));
        }
      }
      return bizList.concat(barsList);
    }

    // No business matches → try bars directly
    const { data: barsOnly } = await ctx.supabase
      .from('bars')
      .select('id, name, location_text')
      .eq('claimed', false)
      .or([
        `name.ilike.%${query}%`,
        `location_text.ilike.%${query}%`,
      ].join(','))
      .limit(20);
    if (Array.isArray(barsOnly) && barsOnly.length) {
      return barsOnly.map((r: any) => ({
        id: `bar:${r.id}`,
        name: r.name,
        category: 'Bar & Restaurant',
        address: r.location_text || undefined,
      }));
    }

    return await searchBusinessesSimple(ctx, query);
  } catch (error) {
    console.error("business.search.smart_error", error);
    return await searchBusinessesSimple(ctx, query);
  }
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
      claimed: true,
    })
    .eq("id", businessId);

  if (ownerError) throw ownerError;

  // 2. Add user's WhatsApp to business_whatsapp_numbers
  const { error: whatsappError } = await ctx.supabase
    .from("business_whatsapp_numbers")
    .insert({
      business_id: businessId,
      whatsapp_e164: ctx.from,
      is_primary: true,
      verified: false,
      added_by_whatsapp: ctx.from,
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
 * Create a business entry from a bars table record
 */
async function createBusinessFromBar(
  ctx: RouterContext,
  barId: string,
  fallbackName?: string,
  fallbackAddress?: string,
  fallbackCategory?: string,
): Promise<{ businessId: string; barId?: string }> {
  const { data: bar, error } = await ctx.supabase
    .from('bars')
    .select('id, name, location_text, country, whatsapp_number')
    .eq('id', barId)
    .maybeSingle();
  if (error) throw error;
  if (!bar && !fallbackName) throw new Error('Bar not found');

  const payload: Record<string, any> = {
    name: bar?.name || fallbackName || 'Business',
    location_text: bar?.location_text || fallbackAddress || null,
    category_name: fallbackCategory || 'Bar & Restaurant',
    owner_user_id: ctx.profileId,
    owner_whatsapp: ctx.from,
    claimed: true,
    is_active: true,
    country: bar?.country || null,
    bar_id: bar?.id || barId,
  };

  const { data: created, error: insertErr } = await ctx.supabase
    .from('business')
    .insert(payload)
    .select('id, bar_id')
    .single();
  if (insertErr) throw insertErr;
  // Mark original bar as claimed to avoid duplicate claims in future searches
  try {
    await ctx.supabase
      .from('bars')
      .update({ claimed: true })
      .eq('id', barId);
  } catch (_) {}
  // Attach menu items to the new business reference (best effort)
  try {
    await ctx.supabase
      .from('restaurant_menu_items')
      .update({ business_id: created?.id })
      .eq('bar_id', barId);
  } catch (_) {}
  return { businessId: created!.id as string, barId: (created?.bar_id ?? barId) as string };
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

async function ensureBarManager(ctx: RouterContext, barId: string): Promise<void> {
  if (!ctx.profileId || !barId) return;
  try {
    await ctx.supabase
      .from('bar_managers')
      .upsert({
        bar_id: barId,
        user_id: ctx.profileId,
        role: 'owner',
        is_active: true,
      }, { onConflict: 'bar_id,user_id' });
  } catch (error) {
    console.error("business.ensure_manager_fail", error);
  }
}
