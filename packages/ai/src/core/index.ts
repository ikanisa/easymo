/**
 * AI Core - Unified Provider Interface
 * 
 * Export all core AI functionality
 */

export type { FastResponseConfig, FastResponseOptions } from './fast-response.js';
export { GeminiFastResponse, getFastResponse,initializeFastResponse } from './fast-response.js';
export type { 
  AIProvider,
  ChatRequest, 
  ProviderMetrics,
  UnifiedConfig, 
} from './unified-provider.js';
export { UnifiedAIProvider } from './unified-provider.js';
