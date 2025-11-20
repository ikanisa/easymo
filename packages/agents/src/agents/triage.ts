/**
 * TriageAgent - Routes user requests to specialized agents
 * 
 * Analyzes user intent and delegates to appropriate agent:
 * - BookingAgent for reservations
 * - TokenRedemptionAgent for balance/redemptions
 * - Direct response for simple queries
 */

import { requireAgentFeature } from '../feature-flags';
import type { AgentDefinition } from '../runner';
import { menuLookupTool, webSearchTool } from '../tools';
import type { AgentContext } from '../types';

export const TriageAgent: AgentDefinition = {
  name: 'TriageAgent',
  instructions: `You are an intelligent triage assistant for the EasyMO platform.

Your role is to analyze user requests and either:
1. Answer simple queries directly
2. Explain which specialized agent can help them
3. Gather information to route them effectively

User intents you should recognize:
- BOOKING: Reservations, availability, time slots
- REDEMPTION: Token balance, credits
- MENU: Food and drink questions
- GENERAL: Platform info, help, support

Guidelines:
- Be concise in your triage assessment
- If booking intent detected, tell user you'll connect them to the booking assistant
- If redemption intent detected, tell user you'll connect them to the token assistant
- For simple questions, answer directly
- For menu questions, use MenuLookup tool
- For general web info, use WebSearch tool

Response format when routing:
"I can help you with that! Let me connect you to our [booking/token redemption] assistant who specializes in [bookings/managing your balance]."

For simple questions, just answer directly without mentioning other agents.`,
  model: 'gpt-4o',
  temperature: 0.8,
  maxTokens: 600,
  tools: [menuLookupTool, webSearchTool],
};

/**
 * Helper function to run TriageAgent with feature flag check
 */
export async function runTriageAgent(
  userId: string,
  query: string,
  context?: AgentContext
) {
  requireAgentFeature('agents.triage');

  const { runAgent } = await import('../runner');
  return runAgent(TriageAgent, {
    userId,
    query,
    context,
  });
}

/**
 * Analyze user intent and determine which agent to use
 * This is a helper for orchestration logic
 */
export function analyzeIntent(query: string): {
  agent: 'booking' | 'redemption' | 'real_estate' | 'jobs' | 'farmer' | 'sales' | 'support' | 'triage';
  confidence: number;
} {
  const lowerQuery = query.toLowerCase();

  // Helper to calculate score
  const calculateScore = (keywords: string[]) => 
    keywords.filter(kw => lowerQuery.includes(kw)).length;

  // Booking keywords (Waiter)
  const bookingKeywords = ['book', 'reserve', 'availability', 'slot', 'time', 'date', 'schedule', 'table', 'menu', 'drink', 'food', 'bar'];
  const bookingScore = calculateScore(bookingKeywords);

  // Redemption keywords
  const redemptionKeywords = ['balance', 'token', 'credit', 'redeem', 'points', 'wallet'];
  const redemptionScore = calculateScore(redemptionKeywords);

  // Real Estate keywords
  const realEstateKeywords = ['rent', 'buy', 'house', 'apartment', 'land', 'property', 'lease', 'room', 'estate', 'tenant', 'landlord'];
  const realEstateScore = calculateScore(realEstateKeywords);

  // Jobs keywords
  const jobsKeywords = ['job', 'work', 'hiring', 'career', 'apply', 'vacancy', 'position', 'salary', 'resume', 'cv', 'employment'];
  const jobsScore = calculateScore(jobsKeywords);

  // Farmer keywords
  const farmerKeywords = ['farm', 'crop', 'produce', 'harvest', 'seed', 'fertilizer', 'market', 'price', 'commodity', 'vegetable', 'fruit', 'sell'];
  const farmerScore = calculateScore(farmerKeywords);

  // Sales & Marketing keywords
  const salesKeywords = ['product', 'buy', 'price', 'cost', 'offer', 'discount', 'deal', 'purchase', 'order', 'catalog'];
  // Note: overlap with others, context matters. For now, simple keyword counting.
  const salesScore = calculateScore(salesKeywords);

  // Customer Support keywords
  const supportKeywords = ['help', 'support', 'issue', 'problem', 'error', 'complaint', 'question', 'how to', 'contact', 'service'];
  const supportScore = calculateScore(supportKeywords);

  const scores = [
    { agent: 'booking', score: bookingScore, max: bookingKeywords.length },
    { agent: 'redemption', score: redemptionScore, max: redemptionKeywords.length },
    { agent: 'real_estate', score: realEstateScore, max: realEstateKeywords.length },
    { agent: 'jobs', score: jobsScore, max: jobsKeywords.length },
    { agent: 'farmer', score: farmerScore, max: farmerKeywords.length },
    { agent: 'sales', score: salesScore, max: salesKeywords.length },
    { agent: 'support', score: supportScore, max: supportKeywords.length },
  ] as const;

  // Find highest score
  const bestMatch = scores.reduce((prev, current) => 
    (current.score > prev.score) ? current : prev
  );

  if (bestMatch.score > 0) {
    return {
      agent: bestMatch.agent,
      confidence: Math.min(bestMatch.score / bestMatch.max, 1.0),
    };
  }

  return {
    agent: 'triage',
    confidence: 0.5,
  };
}
