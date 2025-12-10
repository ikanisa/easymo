/**
 * Real Estate Agent - Configuration
 * 
 * Centralized configuration for model selection and agent behavior.
 */

export interface RealEstateAgentConfig {
  /**
   * AI model to use for the agent
   * @default 'gemini-1.5-flash'
   */
  model: 'gemini-1.5-flash' | 'gpt-4o' | 'gpt-4o-mini';
  
  /**
   * Maximum number of results to return in searches
   * @default 10
   */
  maxResults: number;
  
  /**
   * Enable deep search (external sources)
   * @default true
   */
  enableDeepSearch: boolean;
  
  /**
   * Default search radius in kilometers
   * @default 10
   */
  defaultSearchRadius: number;
}

export const DEFAULT_REAL_ESTATE_CONFIG: RealEstateAgentConfig = {
  model: 'gemini-1.5-flash',
  maxResults: 10,
  enableDeepSearch: true,
  defaultSearchRadius: 10,
};

/**
 * Get configuration with overrides
 */
export function getRealEstateConfig(
  overrides?: Partial<RealEstateAgentConfig>
): RealEstateAgentConfig {
  return {
    ...DEFAULT_REAL_ESTATE_CONFIG,
    ...overrides,
  };
}
