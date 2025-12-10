/**
 * Real Estate Agent - Search by Location Tool
 * 
 * Find properties near GPS coordinates using spatial search.
 */

import type { Tool } from '../../../types/agent.types';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createSearchByLocationTool(supabase: SupabaseClient): Tool {
  return {
    name: 'search_by_coordinates',
    description: 'Find properties near a specific location using GPS coordinates.',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude coordinate' },
        longitude: { type: 'number', description: 'Longitude coordinate' },
        radius_km: { type: 'number', description: 'Search radius in kilometers (default 5)' },
        price_max: { type: 'number', description: 'Maximum monthly price' },
        beds: { type: 'number', description: 'Number of bedrooms' }
      },
      required: ['latitude', 'longitude']
    },
    execute: async (params, context) => {
      const { latitude, longitude, radius_km = 5, price_max, beds } = params;
      
      try {
        const { data, error } = await supabase.rpc('find_nearby_properties', {
          p_lat: latitude,
          p_lng: longitude,
          p_radius_km: radius_km,
          p_max_price: price_max,
          p_bedrooms: beds,
          p_limit: 10
        });
        
        if (error) throw error;
        
        return {
          listings: data || [],
          search_location: { latitude, longitude, radius_km }
        };
      } catch (err) {
        console.error('Location search failed:', err);
        return {
          listings: [],
          error: 'Location search temporarily unavailable'
        };
      }
    }
  };
}
