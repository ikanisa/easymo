/**
 * Real Estate Agent - Tools
 * 
 * Unified tool definitions for the Real Estate agent.
 */

import type { Tool } from '../../../types/agent.types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSearchListingsTool } from './search-listings';
import { createSearchByLocationTool } from './search-by-location';
import { createContactOwnerTool } from './contact-owner';
import { createScheduleViewingTool } from './schedule-viewing';
import { createDeepSearchTool } from './deep-search';

/**
 * Create all tools for the Real Estate agent
 */
export function createRealEstateTools(supabase: SupabaseClient): Tool[] {
  return [
    createSearchListingsTool(supabase),
    createSearchByLocationTool(supabase),
    createContactOwnerTool(supabase),
    createScheduleViewingTool(supabase),
    createDeepSearchTool(supabase),
  ];
}

// Re-export individual tool creators for granular usage
export {
  createSearchListingsTool,
  createSearchByLocationTool,
  createContactOwnerTool,
  createScheduleViewingTool,
  createDeepSearchTool,
};
