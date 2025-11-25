/**
 * Intent Classifier
 * 
 * Hybrid intent classification using:
 * 1. Keyword matching (fast, deterministic)
 * 2. LLM classification (accurate, context-aware)
 * 
 * Determines which agent should handle a message based on:
 * - Keywords in message
 * - Conversation history
 * - User context
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AgentType, ClassifiedIntent } from "./types.ts";

export class IntentClassifier {
  // Keyword mappings for each agent
  private static readonly AGENT_KEYWORDS: Record<AgentType, string[]> = {
    marketplace: [
      "buy", "sell", "product", "shop", "store", "purchase", "selling", "buying",
      "market", "item", "goods", "trade", "merchant"
    ],
    jobs: [
      "job", "work", "employ", "hire", "career", "position", "vacancy", "recruit",
      "application", "resume", "cv", "interview", "salary", "wage"
    ],
    property: [
      "property", "house", "apartment", "rent", "rental", "room", "studio",
      "estate", "landlord", "tenant", "lease", "bedroom", "flat"
    ],
    farmer: [
      "farm", "produce", "crop", "harvest", "agriculture", "vegetable", "fruit",
      "maize", "beans", "cassava", "potato", "tomato", "cabbage"
    ],
    waiter: [
      "menu", "food", "order", "restaurant", "bar", "drink", "meal", "eat",
      "dining", "table", "reservation", "book", "cuisine"
    ],
    insurance: [
      "insurance", "certificate", "carte jaune", "policy", "cover", "insure",
      "premium", "claim", "motor", "vehicle", "car insurance"
    ],
    rides: [
      "ride", "driver", "passenger", "transport", "pick", "drop", "take me",
      "going to", "trip", "travel", "taxi", "moto", "car"
    ],
    sales: [
      "sales", "sell", "selling", "customer", "client", "deal", "offer",
      "discount", "price", "quote", "proposal"
    ],
    business_broker: [
      "business", "company", "enterprise", "startup", "venture", "broker",
      "investment", "partner", "opportunity"
    ],
    support: [
      "help", "support", "question", "how", "what", "why", "problem", "issue",
      "assist", "guide", "explain"
    ],
  };

  constructor(private supabase: SupabaseClient) {}

  /**
   * Classify intent to determine which agent should handle the message
   */
  async classify(
    messageBody: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<ClassifiedIntent> {
    const lowerBody = messageBody.toLowerCase();

    // First, try keyword-based classification
    const keywordMatch = this.classifyByKeywords(lowerBody);
    
    if (keywordMatch.confidence >= 0.8) {
      // High confidence keyword match, use it
      return keywordMatch;
    }

    // If keyword confidence is low, use LLM classification
    // (For now, we'll use keyword-based with lower threshold)
    // TODO: Implement LLM classification using Gemini
    
    if (keywordMatch.confidence >= 0.5) {
      return keywordMatch;
    }

    // Default to support agent for unclear intents
    return {
      agentType: "support",
      confidence: 0.3,
      reason: "No clear intent detected, routing to support",
    };
  }

  /**
   * Classify based on keyword matching
   */
  private classifyByKeywords(lowerBody: string): ClassifiedIntent {
    const scores: Record<AgentType, { score: number; matchedKeywords: string[] }> = {
      marketplace: { score: 0, matchedKeywords: [] },
      jobs: { score: 0, matchedKeywords: [] },
      property: { score: 0, matchedKeywords: [] },
      farmer: { score: 0, matchedKeywords: [] },
      waiter: { score: 0, matchedKeywords: [] },
      insurance: { score: 0, matchedKeywords: [] },
      rides: { score: 0, matchedKeywords: [] },
      sales: { score: 0, matchedKeywords: [] },
      business_broker: { score: 0, matchedKeywords: [] },
      support: { score: 0, matchedKeywords: [] },
    };

    // Count keyword matches for each agent
    for (const [agentType, keywords] of Object.entries(IntentClassifier.AGENT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerBody.includes(keyword)) {
          scores[agentType as AgentType].score++;
          scores[agentType as AgentType].matchedKeywords.push(keyword);
        }
      }
    }

    // Priority boost for time-sensitive domains
    if (scores.rides.score > 0) {
      scores.rides.score *= 1.5; // Rides are time-sensitive
    }
    if (scores.insurance.score > 0) {
      scores.insurance.score *= 1.3; // Insurance is important
    }

    // Find agent with highest score
    let bestAgent: AgentType = "support";
    let bestScore = 0;
    let matchedKeywords: string[] = [];

    for (const [agentType, data] of Object.entries(scores)) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestAgent = agentType as AgentType;
        matchedKeywords = data.matchedKeywords;
      }
    }

    // Calculate confidence (normalize score)
    const totalWords = lowerBody.split(/\s+/).length;
    const confidence = Math.min(0.95, bestScore / Math.max(totalWords * 0.3, 1));

    return {
      agentType: bestAgent,
      confidence,
      reason: matchedKeywords.length > 0
        ? `Matched keywords: ${matchedKeywords.join(", ")}`
        : "Default routing",
      keywords: matchedKeywords,
    };
  }

  /**
   * Classify using LLM (Gemini)
   * TODO: Implement this for more accurate classification
   */
  private async classifyWithLLM(
    messageBody: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<ClassifiedIntent> {
    // Placeholder for LLM implementation
    // Will use Gemini to analyze message and conversation context
    throw new Error("LLM classification not yet implemented");
  }
}
