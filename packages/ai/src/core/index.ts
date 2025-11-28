/**
 * AI Core - Unified Provider Interface
 * 
 * Export all core AI functionality
 */

export { UnifiedAIProvider } from './unified-provider.js';
export type { 
  UnifiedConfig, 
  ChatRequest, 
  ProviderMetrics,
  AIProvider,
} from './unified-provider.js';

export { GeminiFastResponse, initializeFastResponse, getFastResponse } from './fast-response.js';
export type { FastResponseConfig, FastResponseOptions } from './fast-response.js';
