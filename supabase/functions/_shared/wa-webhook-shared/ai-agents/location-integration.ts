/**
 * AI Agent Location Integration Helper
 * 
 * Standardized location resolution before agent execution
 * All AI agents MUST use this before processing user requests
 * 
 * @deprecated This module is being migrated to use the unified LocationService
 * @see supabase/functions/_shared/location/location-service.ts for new implementation
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { LocationService, type LocationResult as UnifiedLocationResult } from "../../location/index.ts";
import { sendText } from "../wa/client.ts";

// Legacy type for backward compatibility
export interface UserLocation {
  lat: number;
  lng: number;
  source: 'cache' | 'saved' | 'shared';
  label?: string;
  address?: string;
  cached_at?: string;
  distance_from_cached?: number;
}

export interface AgentContext {
  userId: string;
  userPhone: string;
  supabase: SupabaseClient;
  agentType: string;
  intent?: string;
  sharedLocation?: {
    lat: number;
    lng: number;
  };
}

export interface AgentLocationContext {
  location: UserLocation;
  metadata: {
    source: string;
    label?: string;
    needsSave?: boolean; // If true, save this location to cache
  };
}

/**
 * Prepare agent context with location
 * This MUST be called before any agent processes a user request
 * 
 * Flow:
 * 1. If user just shared location → save to cache and use it
 * 2. Check 30-minute cache
 * 3. Check saved locations (home/work based on agent type)
 * 4. Prompt user to share location
 * 
 * @returns Location context if available, null if needs prompt
 * 
 * @example
 * ```typescript
 * // In agent handler
 * const locationCtx = await prepareAgentLocation(ctx, {
 *   agentType: 'jobs_agent',
 *   intent: 'job_search'
 * });
 * 
 * if (!locationCtx) {
 *   // User was prompted to share location
 *   return true;
 * }
 * 
 * // Use location for search
 * const jobs = await searchNearbyJobs(
 *   locationCtx.location.lat,
 *   locationCtx.location.lng
 * );
 * ```
 */
export async function prepareAgentLocation(
  ctx: AgentContext,
  config: {
    agentType: string;
    intent?: string;
    requireLocation?: boolean; // If true, always prompt if no location
  },
): Promise<AgentLocationContext | null> {
  
  // STEP 1: If user just shared location, save to cache and use it
  if (ctx.sharedLocation) {
    await LocationService.save(
      ctx.supabase,
      ctx.userId,
      { lat: ctx.sharedLocation.lat, lng: ctx.sharedLocation.lng },
      config.agentType,
      { intent: config.intent, source: 'user_shared' },
    );
    
    return {
      location: {
        lat: ctx.sharedLocation.lat,
        lng: ctx.sharedLocation.lng,
        source: 'shared',
      },
      metadata: {
        source: 'freshly_shared',
        needsSave: false, // Already saved
      },
    };
  }
  
  // STEP 2: Resolve location using unified LocationService (cache → saved → prompt)
  const resolution = await LocationService.resolve(
    ctx.supabase,
    ctx.userId,
    {
      source: config.agentType,
      preferredSavedLabel: determinePreferredLabel(config.agentType, config.intent),
      cacheTTLMinutes: 30,
      context: { intent: config.intent },
    },
    'en', // TODO: Get from ctx if available
  );
  
  // If location found, return it
  if (resolution.location) {
    return {
      location: {
        lat: resolution.location.lat,
        lng: resolution.location.lng,
        source: resolution.source as 'cache' | 'saved' | 'shared',
        label: resolution.label,
      },
      metadata: {
        source: resolution.source || 'unknown',
        label: resolution.label,
        needsSave: false,
      },
    };
  }
  
  // STEP 3: No location available - prompt user
  if (resolution.needsPrompt && config.requireLocation !== false) {
    const promptMessage = resolution.prompt?.message || "📍 Please share your location to continue.";
    await sendText(ctx.userPhone, promptMessage);
  }
  
  return null;
}

/**
 * Determine preferred saved location label based on agent type/intent
 * This replaces the hardcoded LOCATION_PREFERENCES map
 */
function determinePreferredLabel(agentType: string, intent?: string): string | undefined {
  const type = agentType.toLowerCase();
  const intentLower = intent?.toLowerCase() || '';
  
  // Jobs, farmers, real estate prefer home
  if (type.includes('job') || type.includes('farmer') || type.includes('real_estate')) {
    return 'home';
  }
  
  // For intents
  if (intentLower.includes('job') || intentLower.includes('farm') || intentLower.includes('property')) {
    return 'home';
  }
  
  // Others use cache first (no preferred label)
  return undefined;
}

/**
 * Format location for display in agent responses
 */
export function formatLocationContext(locationCtx: AgentLocationContext): string {
  const { location, metadata } = locationCtx;
  
  switch (metadata.source) {
    case 'freshly_shared':
      return '📍 Using your current location';
    case 'cache':
      return `📍 Using your recent location (${formatCacheAge(location.cached_at)})`;
    case 'saved':
      return `📍 Using your ${location.label} location${location.address ? `: ${location.address}` : ''}`;
    default:
      return '📍 Location set';
  }
}

function formatCacheAge(cachedAt?: string): string {
  if (!cachedAt) return 'recent';
  
  try {
    const cached = new Date(cachedAt);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - cached.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes === 1) return '1 min ago';
    if (diffMinutes < 60) return `${diffMinutes} mins ago`;
    return 'recent';
  } catch {
    return 'recent';
  }
}

/**
 * Standard intent extraction from user message
 * Agents should use this to identify what user wants
 * 
 * @returns Simple metadata object with user intent
 */
export function extractUserIntent(
  message: string,
  agentType: string,
): {
  action: string;
  keywords: string[];
  filters?: Record<string, any>;
} {
  const lower = message.toLowerCase();
  
  // Common actions across agents
  const actions = {
    search: ['find', 'search', 'looking for', 'show me', 'need', 'want'],
    list: ['list', 'my', 'view my', 'show my'],
    create: ['post', 'add', 'create', 'register', 'sell'],
    update: ['edit', 'update', 'change', 'modify'],
    delete: ['delete', 'remove', 'cancel'],
  };
  
  for (const [action, keywords] of Object.entries(actions)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return {
        action,
        keywords: keywords.filter(kw => lower.includes(kw)),
      };
    }
  }
  
  return {
    action: 'search', // Default action
    keywords: [],
  };
}
