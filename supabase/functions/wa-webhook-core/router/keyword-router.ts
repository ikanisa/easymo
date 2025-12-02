/**
 * Keyword Router
 * Routes messages based on text content keywords
 */

import { SERVICES } from "../../_shared/config/index.ts";

// ============================================================================
// TYPES
// ============================================================================

export type RoutingDecision = {
  service: string;
  reason: "keyword" | "state" | "interactive" | "fallback" | "greeting";
  confidence: number;
  metadata?: Record<string, unknown>;
};

// ============================================================================
// KEYWORD DEFINITIONS
// ============================================================================

const GREETING_KEYWORDS = [
  "hi", "hello", "hey", "hola", "bonjour", "muraho",
  "menu", "home", "start", "help", "aide",
];

const MOBILITY_KEYWORDS = [
  "ride", "rides", "driver", "drivers", "taxi", "cab",
  "moto", "transport", "trip", "book", "booking",
  "passenger", "passengers", "nearby", "travel",
  "lifan", "truck", "delivery",
];

const INSURANCE_KEYWORDS = [
  "insurance", "assurance", "cover", "policy",
  "claim", "claims", "document", "certificate",
  "sonarwa", "radiant", "prime", "uap",
];

const PROFILE_KEYWORDS = [
  "profile", "wallet", "balance", "transfer",
  "tokens", "money", "payment", "pay",
  "account", "settings", "language",
];

// ============================================================================
// KEYWORD ROUTER
// ============================================================================

/**
 * Route message based on keywords in text
 */
export function routeByKeyword(text: string): RoutingDecision {
  const normalizedText = text.toLowerCase().trim();
  const words = normalizedText.split(/\s+/);

  // Check for greetings first
  if (GREETING_KEYWORDS.some(kw => words.includes(kw) || normalizedText === kw)) {
    return {
      service: SERVICES.CORE,
      reason: "greeting",
      confidence: 1.0,
    };
  }

  // Calculate keyword matches for each service
  const mobilityScore = calculateKeywordScore(words, MOBILITY_KEYWORDS);
  const insuranceScore = calculateKeywordScore(words, INSURANCE_KEYWORDS);
  const profileScore = calculateKeywordScore(words, PROFILE_KEYWORDS);

  // Determine winner
  const maxScore = Math.max(mobilityScore, insuranceScore, profileScore);

  if (maxScore === 0) {
    return {
      service: SERVICES.CORE,
      reason: "fallback",
      confidence: 0.0,
    };
  }

  if (mobilityScore === maxScore) {
    return {
      service: SERVICES.MOBILITY,
      reason: "keyword",
      confidence: mobilityScore,
    };
  }

  if (insuranceScore === maxScore) {
    return {
      service: SERVICES.INSURANCE,
      reason: "keyword",
      confidence: insuranceScore,
    };
  }

  if (profileScore === maxScore) {
    return {
      service: SERVICES.PROFILE,
      reason: "keyword",
      confidence: profileScore,
    };
  }

  return {
    service: SERVICES.CORE,
    reason: "fallback",
    confidence: 0.0,
  };
}

/**
 * Calculate keyword match score
 */
function calculateKeywordScore(words: string[], keywords: string[]): number {
  let matches = 0;
  for (const word of words) {
    if (keywords.some(kw => word.includes(kw) || kw.includes(word))) {
      matches++;
    }
  }
  return matches / Math.max(words.length, 1);
}
