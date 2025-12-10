/**
 * Real Estate Agent - Search Listings Tool
 * 
 * Query internal property listings database with filters.
 */

import type { Tool } from '../../../types/agent.types';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createSearchListingsTool(supabase: SupabaseClient): Tool {
  return {
    name: 'search_listings',
    description: 'Query internal listing DB; filter by price, area, dates, beds, amenities.',
    parameters: {
      type: 'object',
      properties: {
        price_min: { type: 'number', description: 'Minimum price in RWF' },
        price_max: { type: 'number', description: 'Maximum price in RWF' },
        area: { type: 'string', description: 'Location/area to search (e.g., Kigali, Nyamirambo)' },
        beds: { type: 'number', description: 'Number of bedrooms' },
        rental_type: { type: 'string', description: 'short_term or long_term' },
        amenities: { type: 'array', items: { type: 'string' }, description: 'Required amenities' }
      },
      required: ['area']
    },
    execute: async (params, context) => {
      const { price_min, price_max, area, beds, rental_type } = params;
      
      try {
        let query = supabase
          .from('property_listings')
          .select('id, title, description, price_monthly, location, bedrooms, bathrooms, amenities, images, owner_id, is_available, property_type')
          .eq('is_available', true)
          .ilike('location', `%${area}%`)
          .limit(10);
        
        if (price_min) query = query.gte('price_monthly', price_min);
        if (price_max) query = query.lte('price_monthly', price_max);
        if (beds) query = query.eq('bedrooms', beds);
        if (rental_type) query = query.eq('rental_type', rental_type);
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        return { 
          listings: data || [],
          count: data?.length || 0,
          source: 'database'
        };
      } catch (err) {
        console.error('Property search failed:', err);
        return { 
          listings: [],
          count: 0,
          error: 'Search temporarily unavailable. Please try again.',
          source: 'error'
        };
      }
    }
  };
}
