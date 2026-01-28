/**
 * User Context Fetching
 * 
 * Fetches user context including:
 * - Past sourcing requests (memory)
 * - Market knowledge (collective intelligence)
 * - User preferences
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

import { getRelevantMarketKnowledge } from "../memory/market-intelligence.ts";
import { logStructuredEvent } from "../observability.ts";
import type { MarketKnowledge,SourcingRequest, UserContext } from "../types/buy-sell.ts";

/**
 * Fetch user context for agent processing
 * Includes past requests and market knowledge
 */
export async function fetchUserContext(
  userId: string,
  supabase: SupabaseClient,
  correlationId?: string
): Promise<UserContext> {
  const startTime = Date.now();

  try {
    // 1. Get recent requests for this user (Memory)
    const { data: pastRequests, error: requestsError } = await supabase
      .from("sourcing_requests")
      .select("intent_json, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3);

    if (requestsError) {
      logStructuredEvent("USER_CONTEXT_REQUESTS_ERROR", {
        userId,
        error: requestsError.message,
        correlationId,
      }, "warn");
    }

    // 2. Get learned market knowledge (Collective Intelligence)
    // Use smart retrieval based on user's past requests
    let knowledge: MarketKnowledge[] = [];
    
    // Extract keywords from past requests for better knowledge retrieval
    const keywords: string[] = [];
    if (pastRequests && pastRequests.length > 0) {
      pastRequests.forEach(req => {
        const intent = req.intent_json as Record<string, unknown>;
        if (typeof intent.product_name === "string") {
          keywords.push(intent.product_name);
        }
        if (typeof intent.query === "string") {
          keywords.push(intent.query);
        }
      });
    }
    
    const queryText = keywords.length > 0 ? keywords.join(" ") : undefined;
    knowledge = await getRelevantMarketKnowledge(
      supabase,
      queryText,
      undefined, // tags
      10, // limit
      0.5, // minConfidence
      correlationId
    );

    // 3. Get user preferences (optional)
    const { data: profile } = await supabase
      .from("profiles")
      .select("locale, preferred_currency, default_location")
      .eq("id", userId)
      .maybeSingle();

    const duration = Date.now() - startTime;

    logStructuredEvent("USER_CONTEXT_FETCHED", {
      userId,
      pastRequestsCount: pastRequests?.length || 0,
      knowledgeCount: knowledge?.length || 0,
      hasPreferences: !!profile,
      durationMs: duration,
      correlationId,
    });

    return {
      pastRequests: (pastRequests as Array<{
        intent_json: unknown;
        status: string;
        created_at: string;
      }>) || [],
      globalKnowledge: (knowledge as MarketKnowledge[]) || [],
      userPreferences: profile ? {
        preferredLanguage: profile.locale,
        preferredCurrency: profile.preferred_currency,
        defaultLocation: profile.default_location as { lat: number; lng: number } | undefined,
      } : undefined,
    };
  } catch (error) {
    logStructuredEvent("USER_CONTEXT_FETCH_ERROR", {
      userId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, "error");

    // Return empty context on error
    return {
      pastRequests: [],
      globalKnowledge: [],
    };
  }
}

/**
 * Format user context for AI prompt
 */
export function formatUserContextForPrompt(context: UserContext): string {
  const parts: string[] = [];

  if (context.pastRequests.length > 0) {
    parts.push("[USER MEMORY - Past Requests]");
    context.pastRequests.forEach((req, idx) => {
      parts.push(`${idx + 1}. ${JSON.stringify(req.intent_json)} (Status: ${req.status})`);
    });
    parts.push("");
  }

  if (context.globalKnowledge.length > 0) {
    parts.push("[MARKET INTELLIGENCE - Collective Knowledge]");
    context.globalKnowledge.forEach((kb, idx) => {
      const tags = kb.tags?.length ? ` [Tags: ${kb.tags.join(", ")}]` : "";
      parts.push(`${idx + 1}. ${kb.fact_text}${tags}`);
    });
    parts.push("");
  }

  if (context.userPreferences) {
    parts.push("[USER PREFERENCES]");
    if (context.userPreferences.preferredLanguage) {
      parts.push(`Language: ${context.userPreferences.preferredLanguage}`);
    }
    if (context.userPreferences.preferredCurrency) {
      parts.push(`Currency: ${context.userPreferences.preferredCurrency}`);
    }
    if (context.userPreferences.defaultLocation) {
      parts.push(`Default Location: ${context.userPreferences.defaultLocation.lat}, ${context.userPreferences.defaultLocation.lng}`);
    }
    parts.push("");
  }

  return parts.join("\n");
}

