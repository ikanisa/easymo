/**
 * Market Intelligence & Learning System
 * 
 * Implements collective memory for the AI agent:
 * - Learn and persist market facts
 * - Retrieve relevant knowledge for context
 * - Tag-based organization
 * - Confidence scoring
 * 
 * This acts as the "collective intelligence" that improves over time.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent } from "../observability.ts";
import type { MarketKnowledge } from "../types/buy-sell.ts";

/**
 * Learn a new market fact and persist it
 * 
 * @param fact - The market intelligence fact to learn
 * @param tags - Tags for categorization (e.g., ['cement', 'kigali', 'pricing'])
 * @param source - Where this fact came from (e.g., 'agent_discovery', 'user_feedback')
 * @param confidence - Confidence score 0-1 (default: 0.7)
 */
export async function learnMarketFact(
  supabase: SupabaseClient,
  fact: string,
  tags: string[],
  source: string = "agent_discovery",
  confidence: number = 0.7,
  correlationId?: string
): Promise<string | null> {
  try {
    // Check if similar fact already exists (avoid duplicates)
    const { data: existing } = await supabase
      .from("market_knowledge")
      .select("id, fact_text, confidence")
      .eq("fact_text", fact)
      .maybeSingle();

    if (existing) {
      // Update confidence if new confidence is higher
      if (confidence > (existing.confidence as number || 0)) {
        await supabase
          .from("market_knowledge")
          .update({
            confidence,
            source,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        logStructuredEvent("MARKET_KNOWLEDGE_UPDATED", {
          factId: existing.id,
          newConfidence: confidence,
          correlationId,
        });
      }

      return existing.id;
    }

    // Insert new fact
    const { data, error } = await supabase
      .from("market_knowledge")
      .insert({
        fact_text: fact,
        tags,
        source,
        confidence,
      })
      .select("id")
      .single();

    if (error) {
      logStructuredEvent("MARKET_KNOWLEDGE_LEARN_ERROR", {
        error: error.message,
        fact: fact.substring(0, 100),
        correlationId,
      }, "error");
      return null;
    }

    logStructuredEvent("MARKET_KNOWLEDGE_LEARNED", {
      factId: data.id,
      tags: tags.join(", "),
      confidence,
      correlationId,
    });

    return data.id;
  } catch (error) {
    logStructuredEvent("MARKET_KNOWLEDGE_LEARN_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, "error");
    return null;
  }
}

/**
 * Retrieve relevant market knowledge for a query
 * 
 * @param query - Search query or keywords
 * @param tags - Optional tags to filter by
 * @param limit - Maximum number of facts to return
 * @param minConfidence - Minimum confidence threshold (default: 0.5)
 */
export async function getRelevantMarketKnowledge(
  supabase: SupabaseClient,
  query?: string,
  tags?: string[],
  limit: number = 10,
  minConfidence: number = 0.5,
  correlationId?: string
): Promise<MarketKnowledge[]> {
  try {
    let queryBuilder = supabase
      .from("market_knowledge")
      .select("id, fact_text, tags, created_at, source, confidence")
      .gte("confidence", minConfidence)
      .order("confidence", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    // Filter by tags if provided
    if (tags && tags.length > 0) {
      queryBuilder = queryBuilder.contains("tags", tags);
    }

    // Text search if query provided
    if (query) {
      queryBuilder = queryBuilder.ilike("fact_text", `%${query}%`);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      logStructuredEvent("MARKET_KNOWLEDGE_RETRIEVE_ERROR", {
        error: error.message,
        query,
        correlationId,
      }, "error");
      return [];
    }

    logStructuredEvent("MARKET_KNOWLEDGE_RETRIEVED", {
      count: data?.length || 0,
      query,
      tags: tags?.join(", "),
      correlationId,
    });

    return (data as MarketKnowledge[]) || [];
  } catch (error) {
    logStructuredEvent("MARKET_KNOWLEDGE_RETRIEVE_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, "error");
    return [];
  }
}

/**
 * Extract and learn facts from agent interactions
 * 
 * This can be called after successful vendor discovery to learn:
 * - Pricing patterns
 * - Vendor reliability
 * - Regional preferences
 * - Market dynamics
 */
export async function learnFromInteraction(
  supabase: SupabaseClient,
  interaction: {
    query: string;
    location?: { lat: number; lng: number; text?: string };
    vendorsFound: Array<{
      name: string;
      is_onboarded: boolean;
      source: string;
      score?: number;
    }>;
    outcome?: "success" | "partial" | "failed";
    userFeedback?: string;
  },
  correlationId?: string
): Promise<void> {
  const facts: Array<{ fact: string; tags: string[] }> = [];

  // Learn location-specific facts
  if (interaction.location?.text) {
    const locationTag = interaction.location.text.toLowerCase().replace(/\s+/g, "_");
    
    // Learn about vendor availability in location
    const onboardedCount = interaction.vendorsFound.filter(v => v.is_onboarded).length;
    if (onboardedCount > 0) {
      facts.push({
        fact: `Tier 1 vendors available in ${interaction.location.text} for ${interaction.query}`,
        tags: [locationTag, interaction.query.toLowerCase(), "tier1"],
      });
    }

    // Learn about vendor sources
    const sources = [...new Set(interaction.vendorsFound.map(v => v.source))];
    if (sources.length > 0) {
      facts.push({
        fact: `Vendors for ${interaction.query} in ${interaction.location.text} found via: ${sources.join(", ")}`,
        tags: [locationTag, interaction.query.toLowerCase(), "sourcing"],
      });
    }
  }

  // Learn from outcome
  if (interaction.outcome === "success" && interaction.vendorsFound.length > 0) {
    facts.push({
      fact: `Successfully sourced ${interaction.vendorsFound.length} vendors for ${interaction.query}`,
      tags: [interaction.query.toLowerCase(), "success"],
    });
  }

  // Learn from user feedback
  if (interaction.userFeedback) {
    facts.push({
      fact: `User feedback: ${interaction.userFeedback}`,
      tags: [interaction.query.toLowerCase(), "feedback"],
    });
  }

  // Persist all facts
  for (const { fact, tags } of facts) {
    await learnMarketFact(
      supabase,
      fact,
      tags,
      "agent_interaction",
      0.6, // Lower confidence for inferred facts
      correlationId
    );
  }
}

/**
 * Format market knowledge for AI prompt
 */
export function formatMarketKnowledgeForPrompt(knowledge: MarketKnowledge[]): string {
  if (knowledge.length === 0) {
    return "";
  }

  const lines = ["[MARKET INTELLIGENCE - Collective Knowledge]"];
  
  knowledge.forEach((kb, idx) => {
    const tags = kb.tags?.length ? ` [Tags: ${kb.tags.join(", ")}]` : "";
    const confidence = kb.confidence ? ` (Confidence: ${(kb.confidence * 100).toFixed(0)}%)` : "";
    lines.push(`${idx + 1}. ${kb.fact_text}${tags}${confidence}`);
  });

  lines.push(""); // Empty line for spacing
  return lines.join("\n");
}

