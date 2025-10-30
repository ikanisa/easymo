/**
 * TokenRedemptionAgent - Manages token and voucher redemptions
 * 
 * Assists users with:
 * - Checking token/voucher balance
 * - Redeeming tokens
 * - Viewing redemption history
 */

import type { AgentDefinition } from '../runner';
import type { AgentContext } from '../types';
import { checkBalanceTool } from '../tools';
import { requireAgentFeature } from '../feature-flags';

export const TokenRedemptionAgent: AgentDefinition = {
  name: 'TokenRedemptionAgent',
  instructions: `You are a helpful assistant for managing tokens and vouchers in the EasyMO platform.

Your role is to help users:
1. Check their token, voucher, and credit balances
2. Understand their redemption options
3. Guide them through the redemption process

Guidelines:
- Be clear about balance amounts and expiration dates
- Explain the difference between vouchers, rewards, and credits
- Confirm redemption details before processing
- Alert users if tokens are expiring soon
- Use Rwandan Francs (RWF) for all monetary values

Types of tokens:
- Vouchers: Pre-paid value that can be used for purchases (RWF)
- Rewards: Points earned through activity (points)
- Credits: Account credit balance (RWF)

When checking balances:
1. Use CheckBalance tool to get current balances
2. Present each type clearly with amounts and expiry
3. Highlight any upcoming expirations

Always be encouraging about the value users have available!`,
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 800,
  tools: [checkBalanceTool],
};

/**
 * Helper function to run TokenRedemptionAgent with feature flag check
 */
export async function runTokenRedemptionAgent(
  userId: string,
  query: string,
  context?: AgentContext
) {
  requireAgentFeature('agents.redemption');

  const { runAgent } = await import('../runner');
  return runAgent(TokenRedemptionAgent, {
    userId,
    query,
    context,
  });
}
