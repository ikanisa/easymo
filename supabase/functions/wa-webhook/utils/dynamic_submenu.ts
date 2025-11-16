/**
 * Dynamic Submenu Helper
 * Provides reusable functions to fetch and display dynamic submenus from database
 * Eliminates hardcoded menu lists
 */

import type { RouterContext } from "../types.ts";
import { supabase } from "../config.ts";
import type { SupabaseClient } from "../deps.ts";

export interface SubmenuItem {
  key: string;
  name: string;
  icon: string | null;
  display_order: number;
  action_type: string;
  action_target: string | null;
  description: string | null;
}

/**
 * Fetch submenu items for a parent menu from database
 * @param parentKey - The parent menu key (e.g., 'jobs', 'property_rentals', 'wallet')
 * @param countryCode - User's country code for filtering
 * @param language - User's language preference
 * @param client - Optional Supabase client
 * @returns Array of submenu items
 */
export async function fetchSubmenuItems(
  parentKey: string,
  countryCode: string = 'RW',
  language: string = 'en',
  client?: SupabaseClient,
): Promise<SubmenuItem[]> {
  const db = client || supabase;

  const { data, error } = await db.rpc('get_submenu_items', {
    p_parent_key: parentKey,
    p_country_code: countryCode,
    p_language: language,
  });

  if (error) {
    console.error(`Failed to fetch submenu items for ${parentKey}:`, error);
    return [];
  }

  return (data || []) as SubmenuItem[];
}

/**
 * Fetch profile menu items from database
 * @param countryCode - User's country code for filtering
 * @param language - User's language preference
 * @param client - Optional Supabase client
 * @returns Array of profile menu items
 */
export async function fetchProfileMenuItems(
  countryCode: string = 'RW',
  language: string = 'en',
  client?: SupabaseClient,
): Promise<SubmenuItem[]> {
  const db = client || supabase;

  // Determine if country is in Africa by checking countries table
  const { data: countryData } = await db
    .from('countries')
    .select('code')
    .eq('code', countryCode)
    .single();

  const isAfrica = !!countryData; // If country exists in our countries table, it's Africa

  // Fetch all profile menu items
  const { data, error } = await db
    .from('whatsapp_profile_menu_items')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    console.error('Failed to fetch profile menu items:', error);
    return [];
  }

  // Filter by region restrictions
  const filtered = (data || []).filter((item: any) => {
    if (!item.region_restrictions || item.region_restrictions.length === 0) {
      return true; // No restriction = show everywhere
    }
    
    if (item.region_restrictions.includes('africa')) {
      return isAfrica; // Only show in African countries
    }
    
    return true;
  });

  // Map to SubmenuItem format
  return filtered.map((item: any) => ({
    key: item.key,
    name: item.name,
    icon: item.icon,
    display_order: item.display_order,
    action_type: item.action_type || 'action',
    action_target: item.action_target,
    description: item.description_en || item.description || ''
  }));
}

/**
 * Convert submenu items to WhatsApp list row format
 * @param items - Array of submenu items
 * @param idMapper - Optional function to map action_target to IDS constants
 * @returns Array of WhatsApp list rows
 */
export function submenuItemsToRows(
  items: SubmenuItem[],
  idMapper?: (actionTarget: string) => string,
): Array<{ id: string; title: string; description: string }> {
  return items.map((item) => {
    // Use action_target if available, fallback to key
    const routeId = item.action_target || item.key;
    return {
      id: idMapper ? idMapper(routeId) : routeId,
      title: item.icon ? `${item.icon} ${item.name}` : item.name,
      description: item.description || '',
    };
  });
}

/**
 * Get submenu items as WhatsApp rows with back button
 * Convenience function that combines fetch + convert + add back button
 * @param ctx - Router context
 * @param parentKey - Parent menu key
 * @param backButtonId - ID for back button
 * @param backButtonText - Text for back button
 * @param idMapper - Optional function to map keys to IDS constants
 * @returns Array of WhatsApp list rows including back button
 */
export async function getSubmenuRows(
  ctx: RouterContext,
  parentKey: string,
  backButtonId: string,
  backButtonText: string = 'Back to Menu',
  idMapper?: (key: string) => string,
): Promise<Array<{ id: string; title: string; description: string }>> {
  const countryCode = (ctx as { countryCode?: string }).countryCode ?? "RW";
  const items = await fetchSubmenuItems(
    parentKey,
    countryCode,
    ctx.locale || 'en',
    ctx.supabase,
  );

  const rows = submenuItemsToRows(items, idMapper);

  // Add back button
  rows.push({
    id: backButtonId,
    title: backButtonText,
    description: 'Return to previous menu',
  });

  return rows;
}

/**
 * Check if a submenu exists and has items
 * @param parentKey - Parent menu key
 * @param countryCode - User's country code
 * @param client - Optional Supabase client
 * @returns True if submenu exists with active items
 */
export async function hasSubmenu(
  parentKey: string,
  countryCode: string = 'RW',
  client?: SupabaseClient,
): Promise<boolean> {
  const items = await fetchSubmenuItems(parentKey, countryCode, 'en', client);
  return items.length > 0;
}

/**
 * Get the default action for a submenu item
 * Used for routing based on action_type
 * @param item - Submenu item
 * @returns Action identifier
 */
export function getSubmenuAction(item: SubmenuItem): string {
  switch (item.action_type) {
    case 'ai_agent':
      return item.action_target || `ai_agent_${item.key}`;
    case 'external':
      return item.action_target || '';
    case 'navigate':
      return item.action_target || item.key;
    case 'action':
    default:
      return item.action_target || item.key;
  }
}
