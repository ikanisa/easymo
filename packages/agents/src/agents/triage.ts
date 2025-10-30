/**
 * TriageAgent - Routes user requests to specialized agents
 * 
 * Analyzes user intent and delegates to appropriate agent:
 * - BookingAgent for reservations
 * - TokenRedemptionAgent for balance/redemptions
 * - Direct response for simple queries
 */

import type { AgentDefinition } from '../runner';
import type { AgentContext } from '../types';
import { menuLookupTool, webSearchTool } from '../tools';
import { requireAgentFeature } from '../feature-flags';

export const TriageAgent: AgentDefinition = {
  name: 'TriageAgent',
  instructions: `You are an intelligent triage assistant for the EasyMO platform.

Your role is to analyze user requests and either:
1. Answer simple queries directly
2. Explain which specialized agent can help them
3. Gather information to route them effectively

User intents you should recognize:
- BOOKING: Reservations, availability, time slots
- REDEMPTION: Token balance, vouchers, credits
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
  agent: 'booking' | 'redemption' | 'triage';
  confidence: number;
} {
  const lowerQuery = query.toLowerCase();

  // Booking keywords
  const bookingKeywords = [
    'book',
    'reserve',
    'availability',
    'slot',
    'time',
    'date',
    'schedule',
  ];
  const bookingScore = bookingKeywords.filter(kw =>
    lowerQuery.includes(kw)
  ).length;

  // Redemption keywords
  const redemptionKeywords = [
    'balance',
    'voucher',
    'token',
    'credit',
    'redeem',
    'points',
    'wallet',
  ];
  const redemptionScore = redemptionKeywords.filter(kw =>
    lowerQuery.includes(kw)
  ).length;

  if (bookingScore > redemptionScore && bookingScore > 0) {
    return {
      agent: 'booking',
      confidence: Math.min(bookingScore / bookingKeywords.length, 1.0),
    };
  }

  if (redemptionScore > bookingScore && redemptionScore > 0) {
    return {
      agent: 'redemption',
      confidence: Math.min(redemptionScore / redemptionKeywords.length, 1.0),
    };
  }

  return {
    agent: 'triage',
    confidence: 0.5,
  };
}
