/**
 * AI Agents Location Integration Helper
 * 
 * Standard location integration for all AI agents in wa-webhook-ai-agents
 * Provides unified location handling across jobs, farmer, business, waiter, and real estate agents
 * 
 * Usage:
 * ```typescript
 * import { AgentLocationHelper } from './location-helper.ts';
 * 
 * const helper = new AgentLocationHelper(supabase);
 * const location = await helper.resolveUserLocation(userId, 'jobs_agent');
 * 
 * if (!location) {
 *   await helper.promptForLocation(phone, locale, 'job_search');
 *   return;
 * }
 * 
 * // Use location for search
 * const results = await searchNearby(location.lat, location.lng);
 * ```
 */

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { sendText } from "../../wa/client.ts";

export interface UserLocation {
  lat: number;
  lng: number;
  source: 'cache' | 'saved' | 'shared';
  label?: string;
  address?: string;
  cached_at?: string;
}

export interface LocationResolutionResult {
  location: UserLocation | null;
  needsPrompt: boolean;
  promptMessage?: string;
}

/**
 * Agent-specific location preferences
 * Maps agent types to their preferred saved location
 */
const AGENT_LOCATION_PREFERENCES: Record<string, string> = {
  'jobs_agent': 'home',
  'job_search': 'home',
  'farmer_agent': 'home',
  'farm_supplies': 'home',
  'real_estate_agent': 'home',
  'property_search': 'home',
  'business_broker_agent': 'cache_first',
  'business_search': 'cache_first',
  'waiter_agent': 'cache_first',
  'restaurant_search': 'cache_first',
};

/**
 * Location prompts for different agent contexts
 */
const LOCATION_PROMPTS: Record<string, Record<string, string>> = {
  en: {
    'jobs_agent': "📍 To find jobs near you, please share your location or save your home address in Profile → Saved Locations.",
    'farmer_agent': "📍 To find nearby markets and suppliers, please share your farm location.",
    'real_estate_agent': "📍 To find properties near you, please share your location.",
    'business_broker_agent': "📍 To find nearby businesses, please share your location.",
    'waiter_agent': "📍 To find nearby restaurants, please share your location.",
    'default': "📍 Please share your location to continue.",
  },
  fr: {
    'jobs_agent': "📍 Pour trouver des emplois près de vous, partagez votre position ou enregistrez votre adresse.",
    'farmer_agent': "📍 Pour trouver les marchés et fournisseurs, partagez l'emplacement de votre ferme.",
    'real_estate_agent': "📍 Pour trouver des propriétés près de vous, partagez votre position.",
    'business_broker_agent': "📍 Pour trouver des entreprises à proximité, partagez votre position.",
    'waiter_agent': "📍 Pour trouver des restaurants à proximité, partagez votre position.",
    'default': "📍 Veuillez partager votre position pour continuer.",
  },
  rw: {
    'jobs_agent': "📍 Gushaka imirimo hafi yawe, sangiza aho uriho cyangwa bika aho utuye.",
    'farmer_agent': "📍 Gushaka amasoko n'ababigisha, sangiza aho murima uri.",
    'real_estate_agent': "📍 Gushaka amazu hafi yawe, sangiza aho uriho.",
    'business_broker_agent': "📍 Gushaka ubucuruzi hafi yawe, sangiza aho uriho.",
    'waiter_agent': "📍 Gushaka resitora hafi yawe, sangiza aho uriho.",
    'default': "📍 Nyamuneka sangiza aho uriho gukomeza.",
  },
};

/**
 * AI Agent Location Helper
 * 
 * Provides standard location resolution for all AI agents
 */
export class AgentLocationHelper {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Resolve user location with standard priority logic
   * 
   * Priority: Cache (30min) → Saved (home/work) → Prompt
   * 
   * @param userId - User's profile ID
   * @param agentType - Agent type (jobs_agent, farmer_agent, etc.)
   * @param cacheMinutes - Cache validity (default 30 minutes)
   * @returns Location resolution result
   */
  async resolveUserLocation(
    userId: string,
    agentType: string,
    cacheMinutes: number = 30
  ): Promise<LocationResolutionResult> {
    
    // STEP 1: Check 30-minute cached location
    try {
      const { data: cached, error: cacheError } = await this.supabase.rpc('get_cached_location', {
        _user_id: userId,
        _cache_minutes: cacheMinutes,
      });
      
      if (!cacheError && cached && cached.length > 0 && cached[0].is_valid) {
        return {
          location: {
            lat: cached[0].lat,
            lng: cached[0].lng,
            source: 'cache',
            cached_at: cached[0].cached_at,
          },
          needsPrompt: false,
        };
      }
    } catch (error) {
      console.warn('location_helper.cache_check_failed', error);
    }
    
    // STEP 2: Check saved locations (prefer home for most agents)
    const preferredLabel = AGENT_LOCATION_PREFERENCES[agentType] || 'home';
    
    if (preferredLabel !== 'cache_first') {
      try {
        const { data: saved, error: savedError } = await this.supabase
          .from('saved_locations')
          .select('label, lat, lng, address')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        if (!savedError && saved && saved.length > 0) {
          // Try to find preferred location (e.g., 'home')
          const preferred = saved.find(loc => loc.label === preferredLabel);
          
          if (preferred) {
            return {
              location: {
                lat: Number(preferred.lat),
                lng: Number(preferred.lng),
                source: 'saved',
                label: preferred.label,
                address: preferred.address || undefined,
              },
              needsPrompt: false,
            };
          }
          
          // If no preferred, use first saved location
          const first = saved[0];
          return {
            location: {
              lat: Number(first.lat),
              lng: Number(first.lng),
              source: 'saved',
              label: first.label,
              address: first.address || undefined,
            },
            needsPrompt: false,
          };
        }
      } catch (error) {
        console.warn('location_helper.saved_check_failed', error);
      }
    }
    
    // STEP 3: No location available - needs prompt
    return {
      location: null,
      needsPrompt: true,
    };
  }

  /**
   * Save location to cache after user shares
   * 
   * @param userId - User's profile ID
   * @param lat - Latitude
   * @param lng - Longitude
   * @returns Success status
   */
  async saveLocationToCache(
    userId: string,
    lat: number,
    lng: number,
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('update_user_location_cache', {
        _user_id: userId,
        _lat: lat,
        _lng: lng,
      });
      
      if (error) {
        console.error('location_helper.cache_save_failed', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('location_helper.cache_save_error', error);
      return false;
    }
  }

  /**
   * Prompt user to share location
   * 
   * @param phone - User's phone number
   * @param locale - User's locale (en, fr, rw)
   * @param agentType - Agent type for context-specific prompt
   */
  async promptForLocation(
    phone: string,
    locale: string,
    agentType: string,
  ): Promise<void> {
    const lang = locale.split('-')[0] || 'en';
    const prompts = LOCATION_PROMPTS[lang] || LOCATION_PROMPTS['en'];
    const message = prompts[agentType] || prompts['default'];
    
    await sendText(phone, message);
  }

  /**
   * Format location context for display in agent responses
   * 
   * @param location - User location
   * @returns Formatted location string
   */
  formatLocationContext(location: UserLocation): string {
    switch (location.source) {
      case 'shared':
        return '📍 Using your current location';
      case 'cache':
        return `📍 Using your recent location`;
      case 'saved':
        return `📍 Using your ${location.label} location${location.address ? `: ${location.address}` : ''}`;
      default:
        return '📍 Location set';
    }
  }

  /**
   * Get nearby items using PostGIS search
   * Generic helper for any table with lat/lng/geography columns
   * 
   * @param table - Table name (job_listings, properties, businesses, etc.)
   * @param lat - User latitude
   * @param lng - User longitude
   * @param radiusKm - Search radius in kilometers
   * @param limit - Max results
   * @param filters - Additional filters (status, category, etc.)
   * @returns Nearby items with distance
   */
  async searchNearby(
    table: string,
    lat: number,
    lng: number,
    radiusKm: number = 50,
    limit: number = 20,
    filters: Record<string, any> = {}
  ): Promise<any[]> {
    try {
      // Use RPC function if available, otherwise fall back to text search
      const rpcName = `search_nearby_${table}`;
      
      const { data, error } = await this.supabase.rpc(rpcName, {
        _lat: lat,
        _lng: lng,
        _radius_km: radiusKm,
        _limit: limit,
        ...filters,
      });
      
      if (error) {
        console.warn(`location_helper.nearby_search_failed: ${rpcName}`, error);
        // Fall back to text-based search if GPS search unavailable
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('location_helper.nearby_search_error', error);
      return [];
    }
  }
}

/**
 * Quick helper to add location-aware search to agent tools
 * 
 * @example
 * ```typescript
 * const tools = [
 *   createLocationAwareSearchTool(
 *     'search_jobs',
 *     'Search for jobs near user location',
 *     supabase,
 *     'job_listings',
 *     { status: 'open' }
 *   ),
 *   // ... other tools
 * ];
 * ```
 */
export function createLocationAwareSearchTool(
  name: string,
  description: string,
  supabase: SupabaseClient,
  table: string,
  defaultFilters: Record<string, any> = {}
) {
  return {
    name,
    description,
    parameters: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID for location lookup' },
        radius_km: { type: 'number', description: 'Search radius in kilometers', default: 50 },
        limit: { type: 'number', description: 'Max results', default: 20 },
        ...Object.fromEntries(
          Object.keys(defaultFilters).map(key => [
            key,
            { type: 'string', description: `Filter by ${key}` }
          ])
        ),
      },
      required: ['user_id'],
    },
    execute: async (params: any) => {
      const helper = new AgentLocationHelper(supabase);
      
      // Resolve user location
      const result = await helper.resolveUserLocation(params.user_id, name);
      
      if (!result.location) {
        return {
          message: 'Please share your location to search nearby.',
          needs_location: true,
        };
      }
      
      // Search nearby
      const items = await helper.searchNearby(
        table,
        result.location.lat,
        result.location.lng,
        params.radius_km || 50,
        params.limit || 20,
        { ...defaultFilters, ...params }
      );
      
      return {
        location_context: helper.formatLocationContext(result.location),
        count: items.length,
        items,
      };
    },
  };
}
