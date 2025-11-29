/**
 * Google Custom Search Integration
 * Web search for grounding AI responses with factual information
 */

import { AI_CONFIG } from '../ai/config';

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: string;
  searchTime: number;
}

/**
 * Perform Google Custom Search
 */
export const googleSearch = async (
  query: string,
  options?: {
    num?: number;
    start?: number;
    dateRestrict?: string;
    siteSearch?: string;
  }
): Promise<SearchResponse> => {
  const apiKey = AI_CONFIG.apiKeys.googleSearch;
  const engineId = AI_CONFIG.apiKeys.googleSearchEngine;

  if (apiKey === 'PLACEHOLDER_SEARCH_KEY' || engineId === 'PLACEHOLDER_ENGINE_ID') {
    throw new Error('Google Search not configured. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID');
  }

  if (!AI_CONFIG.features.googleSearchGrounding) {
    throw new Error('Google Search grounding is disabled. Set ENABLE_GOOGLE_SEARCH_GROUNDING=true');
  }

  const params = new URLSearchParams({
    key: apiKey,
    cx: engineId,
    q: query,
    num: (options?.num || 10).toString(),
    start: (options?.start || 1).toString(),
  });

  if (options?.dateRestrict) {
    params.append('dateRestrict', options.dateRestrict);
  }

  if (options?.siteSearch) {
    params.append('siteSearch', options.siteSearch);
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      results: (data.items || []).map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        displayLink: item.displayLink,
      })),
      totalResults: data.searchInformation?.totalResults || '0',
      searchTime: data.searchInformation?.searchTime || 0,
    };
  } catch (error) {
    console.error('Google Search failed:', error);
    return {
      results: [],
      totalResults: '0',
      searchTime: 0,
    };
  }
};

/**
 * Search and summarize results
 */
export const searchAndSummarize = async (
  query: string,
  maxResults: number = 5
): Promise<{
  summary: string;
  sources: SearchResult[];
}> => {
  const searchResults = await googleSearch(query, { num: maxResults });

  if (searchResults.results.length === 0) {
    return {
      summary: 'No search results found.',
      sources: [],
    };
  }

  // Combine snippets for summarization
  const snippets = searchResults.results
    .map((r, idx) => `[${idx + 1}] ${r.title}: ${r.snippet}`)
    .join('\n\n');

  return {
    summary: snippets,
    sources: searchResults.results,
  };
};

/**
 * Tool definition for AI agents
 */
export const googleSearchTool = {
  type: 'function' as const,
  function: {
    name: 'google_search',
    description: 'Search the web using Google to find current, factual information',
    parameters: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'Search query to find information on the web',
        },
        num: {
          type: 'number',
          description: 'Number of results to return (1-10, default: 5)',
          minimum: 1,
          maximum: 10,
        },
      },
      required: ['query'],
    },
  },
};
