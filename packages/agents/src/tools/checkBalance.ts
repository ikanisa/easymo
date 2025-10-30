/**
 * Tool: Check Token Balance
 * 
 * Checks user's token/voucher balance.
 */

import { z } from 'zod';
import type { AgentContext } from '../types';
import { logToolInvocation } from '../observability';

export const checkBalanceSchema = z.object({
  tokenType: z.enum(['voucher', 'reward', 'credit']).optional()
    .describe('Type of token to check, or all if not specified'),
});

export type CheckBalanceParams = z.infer<typeof checkBalanceSchema>;

interface TokenBalance {
  type: string;
  balance: number;
  currency: string;
  expiresAt?: string;
}

/**
 * Execute balance check
 */
export async function executeCheckBalance(
  params: CheckBalanceParams,
  context: AgentContext
): Promise<{ balances: TokenBalance[] }> {
  await logToolInvocation('CheckBalance', context, params);

  // Placeholder implementation
  // TODO: Query Supabase user tokens/wallet table
  const mockBalances: TokenBalance[] = [
    {
      type: 'voucher',
      balance: 5000,
      currency: 'RWF',
      expiresAt: '2025-12-31',
    },
    {
      type: 'reward',
      balance: 150,
      currency: 'points',
    },
    {
      type: 'credit',
      balance: 10000,
      currency: 'RWF',
    },
  ];

  if (params.tokenType) {
    return {
      balances: mockBalances.filter(b => b.type === params.tokenType),
    };
  }

  return { balances: mockBalances };
}

export const checkBalanceTool = {
  name: 'CheckBalance',
  description: 'Check user token, voucher, or credit balance',
  parameters: checkBalanceSchema,
  execute: executeCheckBalance,
};
