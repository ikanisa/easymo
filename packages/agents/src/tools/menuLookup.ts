/**
 * Tool: Menu Lookup
 * 
 * Searches menu items for drinks, food, or products.
 */

import { z } from 'zod';

import { logToolInvocation } from '../observability';
import type { AgentContext } from '../types';

export const menuLookupSchema = z.object({
  query: z.string().min(1).max(200).describe('Search query for menu items'),
  category: z.enum(['drinks', 'food', 'all']).default('all')
    .describe('Category to search in'),
  limit: z.number().int().min(1).max(20).default(10)
    .describe('Maximum number of items to return'),
});

export type MenuLookupParams = z.infer<typeof menuLookupSchema>;

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  available: boolean;
}

/**
 * Execute menu lookup
 * 
 * Integrates with Supabase to query menu items
 */
export async function executeMenuLookup(
  params: MenuLookupParams,
  context: AgentContext
): Promise<{ items: MenuItem[] }> {
  await logToolInvocation('MenuLookup', context, params);

  // Placeholder implementation
  // TODO: Query Supabase menu table
  const mockItems: MenuItem[] = [
    {
      id: 'item-1',
      name: 'Primus Beer',
      description: 'Local Rwandan lager beer, 330ml',
      price: 1000,
      currency: 'RWF',
      category: 'drinks',
      available: true,
    },
    {
      id: 'item-2',
      name: 'Brochette',
      description: 'Grilled meat skewers with vegetables',
      price: 2500,
      currency: 'RWF',
      category: 'food',
      available: true,
    },
  ];

  // Filter by category if specified
  let filtered = mockItems;
  if (params.category !== 'all') {
    filtered = mockItems.filter(item => item.category === params.category);
  }

  // Filter by query (simple text match)
  if (params.query) {
    const queryLower = params.query.toLowerCase();
    filtered = filtered.filter(
      item =>
        item.name.toLowerCase().includes(queryLower) ||
        item.description.toLowerCase().includes(queryLower)
    );
  }

  return {
    items: filtered.slice(0, params.limit),
  };
}

export const menuLookupTool = {
  name: 'MenuLookup',
  description: 'Search for drinks, food, or products available on the menu',
  parameters: menuLookupSchema,
  execute: executeMenuLookup,
};
