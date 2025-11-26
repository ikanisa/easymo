/**
 * AI Agent Location Integration Helper
 * 
 * Standardized location resolution before agent execution
 * All AI agents MUST use this before processing user requests
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveUserLocation, saveLocationToCache, type UserLocation } from "../utils/location-resolver.ts";
import { sendText } from "../wa/client.ts";

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
    await saveLocationToCache(
      ctx.supabase,
      ctx.userId,
      ctx.sharedLocation.lat,
      ctx.sharedLocation.lng,
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
  
  // STEP 2: Resolve location (cache → saved → prompt)
  const resolution = await resolveUserLocation(
    ctx.supabase,
    ctx.userId,
    {
      agentType: config.agentType,
      intent: config.intent,
    },
  );
  
  // If location found, return it
  if (resolution.location) {
    return {
      location: resolution.location,
      metadata: {
        source: resolution.location.source,
        label: resolution.location.label,
        needsSave: false,
      },
    };
  }
  
  // STEP 3: No location available - prompt user
  if (resolution.needsPrompt && config.requireLocation !== false) {
    await sendText(ctx.userPhone, resolution.promptMessage || "📍 Please share your location to continue.");
    
    // Save locations available for reference
    if (resolution.availableSaved && resolution.availableSaved.length > 0) {
      const savedList = resolution.availableSaved
        .map((s, i) => `${i + 1}. ${s.label}: ${s.address || 'No address'}`)
        .join('\n');
      
      await sendText(
        ctx.userPhone,
        `You can also save locations for quick access:\n${savedList}\n\nGo to Profile → Saved Locations to manage.`,
      );
    }
  }
  
  return null;
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
