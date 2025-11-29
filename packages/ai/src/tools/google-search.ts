import { childLogger } from '@easymo/commons';
import { z } from 'zod';

import type { Tool, ToolContext } from '../core/types';

const log = childLogger({ service: 'ai' });

export const googleSearchTool: Tool = {
  name: 'google_search',
  description: 'Perform a Google Search using the Custom Search JSON API.',
  category: 'search',
  enabled: true,
  requiresAuth: false,
  parameters: z.object({
    query: z.string().describe('The search query.'),
    num_results: z.number().optional().default(10).describe('Number of results to return.'),
    country: z.string().optional().describe('Country code to restrict search (e.g., "mt" for Malta).'),
  }),
  execute: async (args: { query: string; num_results?: number; country?: string }, context: ToolContext) => {
    const apiKey = context.env.GOOGLE_SEARCH_API_KEY;
    const cx = context.env.GOOGLE_SEARCH_CX;

    if (!apiKey || !cx) {
      throw new Error('GOOGLE_API_KEY or GOOGLE_SEARCH_ENGINE_ID is not set');
    }

    const params = new URLSearchParams({
      key: apiKey,
      cx: cx,
      q: args.query,
      num: (args.num_results || 10).toString(),
    });

    if (args.country) {
      params.append('gl', args.country);
    }

    try {
      const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Google Search request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      if (data.error) {
        throw new Error(`Google Search API error: ${data.error.message}`);
      }

      return {
        items: (data.items || []).map((item: any) => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          pagemap: item.pagemap,
        })),
        searchInformation: data.searchInformation,
      };
    } catch (error) {
      log.error('Google Search error:', error);
      throw new Error(`Failed to perform Google search: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
