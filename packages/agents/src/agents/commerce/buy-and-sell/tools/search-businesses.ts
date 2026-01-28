/**
 * Business Search Tools
 * 
 * Tools for discovering businesses using AI-powered search and category-based filtering.
 */

import { childLogger } from '@easymo/commons';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Tool } from '../../../../types/agent.types';
import { 
  DEFAULT_SEARCH_LIMIT, 
  DEFAULT_SEARCH_RADIUS_KM,
  RPC_FIND_NEARBY_BUSINESSES,
  RPC_SEARCH_BUSINESSES_AI} from '../config';

const log = childLogger({ service: 'agents', tool: 'search-businesses' });

/**
 * AI-powered natural language business search
 */
export function searchBusinessesAI(supabase: SupabaseClient): Tool {
  return {
    name: 'search_businesses_ai',
    description: 'Natural language search for businesses. Finds businesses based on user query like "I need a computer" or "pharmacy nearby". Uses AI-powered relevance ranking.',
    parameters: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'Natural language query (e.g., "computer shop", "print documents", "fix phone")' 
        },
        lat: { 
          type: 'number', 
          description: 'User latitude (optional, for location-aware results)' 
        },
        lng: { 
          type: 'number', 
          description: 'User longitude (optional, for location-aware results)' 
        },
        radius_km: { 
          type: 'number', 
          description: `Search radius in km (default ${DEFAULT_SEARCH_RADIUS_KM})` 
        },
        limit: { 
          type: 'number', 
          description: `Max results (default ${DEFAULT_SEARCH_LIMIT})` 
        }
      },
      required: ['query']
    },
    execute: async (params, context) => {
      const { 
        query, 
        lat = null, 
        lng = null, 
        radius_km = DEFAULT_SEARCH_RADIUS_KM, 
        limit = DEFAULT_SEARCH_LIMIT 
      } = params;
      
      log.info({ query, lat, lng }, 'Executing AI business search');
      
      const { data, error } = await supabase.rpc(RPC_SEARCH_BUSINESSES_AI, {
        p_query: query,
        p_lat: lat,
        p_lng: lng,
        p_radius_km: radius_km,
        p_limit: limit
      });

      if (error) {
        log.error({ error }, 'AI business search failed');
        throw new Error(`AI search failed: ${error.message}`);
      }

      log.info({ count: data?.length || 0 }, 'AI search returned results');
      return { 
        businesses: data,
        source: 'ai_search'
      };
    }
  };
}

/**
 * Category-based business search with location filtering
 */
export function searchBusinesses(supabase: SupabaseClient): Tool {
  return {
    name: 'search_businesses',
    description: 'Find businesses by category and location. Use search_businesses_ai for natural language queries.',
    parameters: {
      type: 'object',
      properties: {
        category: { 
          type: 'string', 
          description: 'Business category (e.g., pharmacy, restaurant, hardware)' 
        },
        lat: { type: 'number', description: 'Latitude' },
        lng: { type: 'number', description: 'Longitude' },
        radius_km: { 
          type: 'number', 
          description: `Search radius in km (default ${DEFAULT_SEARCH_RADIUS_KM})` 
        },
        limit: { 
          type: 'number', 
          description: `Max results (default ${DEFAULT_SEARCH_LIMIT})` 
        }
      },
      required: ['category', 'lat', 'lng']
    },
    execute: async (params, context) => {
      const { 
        category, 
        lat, 
        lng, 
        radius_km = DEFAULT_SEARCH_RADIUS_KM, 
        limit = DEFAULT_SEARCH_LIMIT 
      } = params;
      
      const { data, error } = await supabase.rpc(RPC_FIND_NEARBY_BUSINESSES, {
        p_lat: lat,
        p_lng: lng,
        p_radius_km: radius_km,
        p_category: category,
        p_limit: limit
      });

      if (error) {
        log.error({ error }, 'Nearby business search failed');
        throw new Error(`Business search failed: ${error.message}`);
      }

      return { businesses: data };
    }
  };
}

/**
 * Get all tools for business search
 */
export function getBusinessSearchTools(supabase: SupabaseClient): Tool[] {
  return [
    searchBusinessesAI(supabase),
    searchBusinesses(supabase)
  ];
}
