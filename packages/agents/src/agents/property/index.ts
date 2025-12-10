/**
 * Real Estate Agent - Main Exports
 * 
 * Consolidated exports for the Real Estate domain.
 */

export { RealEstateAgent } from './real-estate.agent';
export { REAL_ESTATE_SYSTEM_PROMPT } from './prompts';
export { 
  getRealEstateConfig, 
  DEFAULT_REAL_ESTATE_CONFIG,
  type RealEstateAgentConfig 
} from './config';
export { createRealEstateTools } from './tools';
