/**
 * Database-Driven Lookup Loader
 * 
 * Replaces hardcoded configurations with database-driven lookups.
 * Used by AI agents to fetch verticals, categories, types, and enums dynamically.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ServiceVertical {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  agent_slugs: string[];
  keywords: string[];
  is_active: boolean;
  priority: number;
  active_countries: string[];
}

export interface JobCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  parent_category_id: string | null;
  is_active: boolean;
  display_order: number;
  active_countries: string[];
  keywords: string[];
}

export interface PropertyType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  display_order: number;
  is_residential: boolean;
  is_commercial: boolean;
  active_countries: string[];
}

export interface InsuranceType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  display_order: number;
  typical_duration_months: number | null;
  requires_inspection: boolean;
  active_countries: string[];
}

export interface ModerationRule {
  id: string;
  rule_type: 'out_of_scope' | 'blocked' | 'flagged' | 'allowed';
  pattern: string;
  description: string | null;
  category: string | null;
  is_active: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  regex_flags: string;
  auto_response_template: string | null;
}

export interface ToolEnumValue {
  id: string;
  enum_type: string;
  value: string;
  label: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  context_filter: Record<string, any> | null;
}

/**
 * Lookup Loader Class
 * 
 * Provides methods to load configuration from database instead of hardcoded files.
 * Includes caching to minimize database calls.
 */
export class LookupLoader {
  private supabase: SupabaseClient;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get cached data or fetch from database
   */
  private async getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }

    const data = await fetcher();
    this.cache.set(key, { data, timestamp: now });
    return data;
  }

  /**
   * Load all active service verticals
   */
  async getServiceVerticals(country?: string): Promise<ServiceVertical[]> {
    return this.getCached(`verticals:${country || 'all'}`, async () => {
      let query = this.supabase
        .from('service_verticals')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (country) {
        query = query.contains('active_countries', [country]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ServiceVertical[];
    });
  }

  /**
   * Get service vertical by slug
   */
  async getServiceVertical(slug: string): Promise<ServiceVertical | null> {
    const verticals = await this.getServiceVerticals();
    return verticals.find((v) => v.slug === slug) || null;
  }

  /**
   * Detect vertical from query using keywords
   */
  async detectVerticalFromQuery(query: string): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('detect_vertical_from_query', {
      p_query: query,
    });

    if (error) {
      console.error('Error detecting vertical:', error);
      return null;
    }

    return data;
  }

  /**
   * Check if query is out of scope
   */
  async isOutOfScope(query: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('is_query_out_of_scope', {
      p_query: query,
    });

    if (error) {
      console.error('Error checking scope:', error);
      return false;
    }

    return data === true;
  }

  /**
   * Get job categories
   */
  async getJobCategories(country?: string): Promise<JobCategory[]> {
    return this.getCached(`job_categories:${country || 'all'}`, async () => {
      let query = this.supabase
        .from('job_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (country) {
        query = query.contains('active_countries', [country]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as JobCategory[];
    });
  }

  /**
   * Get property types
   */
  async getPropertyTypes(country?: string): Promise<PropertyType[]> {
    return this.getCached(`property_types:${country || 'all'}`, async () => {
      let query = this.supabase
        .from('property_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (country) {
        query = query.contains('active_countries', [country]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PropertyType[];
    });
  }

  /**
   * Get insurance types
   */
  async getInsuranceTypes(country?: string): Promise<InsuranceType[]> {
    return this.getCached(`insurance_types:${country || 'all'}`, async () => {
      let query = this.supabase
        .from('insurance_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (country) {
        query = query.contains('active_countries', [country]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InsuranceType[];
    });
  }

  /**
   * Get moderation rules by type
   */
  async getModerationRules(
    ruleType?: 'out_of_scope' | 'blocked' | 'flagged' | 'allowed'
  ): Promise<ModerationRule[]> {
    return this.getCached(`moderation:${ruleType || 'all'}`, async () => {
      let query = this.supabase
        .from('moderation_rules')
        .select('*')
        .eq('is_active', true);

      if (ruleType) {
        query = query.eq('rule_type', ruleType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ModerationRule[];
    });
  }

  /**
   * Get tool enum values for dynamic tool parameters
   */
  async getToolEnumValues(enumType: string, context?: Record<string, any>): Promise<string[]> {
    return this.getCached(`enum:${enumType}:${JSON.stringify(context || {})}`, async () => {
      const query = this.supabase
        .from('tool_enum_values')
        .select('value')
        .eq('enum_type', enumType)
        .eq('is_active', true)
        .order('display_order');

      const { data, error } = await query;
      if (error) throw error;
      return (data as ToolEnumValue[]).map((item) => item.value);
    });
  }

  /**
   * Get tool enum values with labels (for UI display)
   */
  async getToolEnumValuesWithLabels(
    enumType: string
  ): Promise<Array<{ value: string; label: string; description: string | null }>> {
    const { data, error } = await this.supabase.rpc('get_tool_enum_values', {
      p_enum_type: enumType,
    });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get available services as formatted string (for prompts)
   */
  async getAvailableServicesText(): Promise<string> {
    const verticals = await this.getServiceVerticals();
    return verticals.map((v) => v.name).join(', ');
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Set cache TTL
   */
  setCacheTTL(ttlMs: number): void {
    this.cacheTTL = ttlMs;
  }
}

/**
 * Singleton instance (optional)
 * Usage: const loader = getLookupLoader(supabase);
 */
let loaderInstance: LookupLoader | null = null;

export function getLookupLoader(supabase: SupabaseClient): LookupLoader {
  if (!loaderInstance) {
    loaderInstance = new LookupLoader(supabase);
  }
  return loaderInstance;
}

/**
 * Reset singleton (useful for testing)
 */
export function resetLookupLoader(): void {
  loaderInstance = null;
}
