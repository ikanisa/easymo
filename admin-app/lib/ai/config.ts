/**
 * AI Configuration - Centralized AI provider settings
 */

import type { AIProvider, RateLimitConfig, FallbackConfig } from './types';

export const AI_CONFIG = {
  // Feature Flags
  features: {
    openaiRealtime: process.env.ENABLE_OPENAI_REALTIME === 'true',
    geminiLive: process.env.ENABLE_GEMINI_LIVE === 'true',
    imageGeneration: process.env.ENABLE_IMAGE_GENERATION === 'true',
    googleSearchGrounding: process.env.ENABLE_GOOGLE_SEARCH_GROUNDING === 'true',
  },

  // API Keys (use placeholders for now)
  apiKeys: {
    openai: process.env.OPENAI_API_KEY || 'PLACEHOLDER_OPENAI_KEY',
    openaiOrg: process.env.OPENAI_ORG_ID || 'PLACEHOLDER_ORG_ID',
    googleAI: process.env.GOOGLE_AI_API_KEY || 'PLACEHOLDER_GOOGLE_AI_KEY',
    googleCloud: process.env.GOOGLE_CLOUD_PROJECT || 'PLACEHOLDER_PROJECT_ID',
    googleMaps: process.env.GOOGLE_MAPS_API_KEY || 'PLACEHOLDER_MAPS_KEY',
    googleSearch: process.env.GOOGLE_SEARCH_API_KEY || 'PLACEHOLDER_SEARCH_KEY',
    googleSearchEngine: process.env.GOOGLE_SEARCH_ENGINE_ID || 'PLACEHOLDER_ENGINE_ID',
  },

  // Rate Limiting
  rateLimits: {
    openai: {
      requestsPerMinute: 60,
      tokensPerMinute: 150000,
      concurrent: 10,
    } as RateLimitConfig,
    gemini: {
      requestsPerMinute: 60,
      concurrent: 5,
    } as RateLimitConfig,
  },

  // Fallback Strategy
  fallback: {
    enabled: true,
    providers: ['openai', 'gemini'] as AIProvider[],
    maxRetries: 3,
    retryDelay: 1000,
  } as FallbackConfig,

  // Default Models
  defaultModels: {
    openai: 'gpt-4o-mini',
    gemini: 'gemini-2.0-flash-exp',
  },

  // Timeout Settings (ms)
  timeouts: {
    completion: 30000,
    streaming: 60000,
    realtime: 120000,
  },

  // Context Window Limits
  contextLimits: {
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'gpt-3.5-turbo': 16385,
    'o1': 200000,
    'o1-mini': 128000,
    'o3-mini': 128000,
    'gemini-2.0-flash-exp': 1000000,
    'gemini-1.5-pro': 2000000,
    'gemini-1.5-flash': 1000000,
    'gemini-1.5-flash-8b': 1000000,
  },
} as const;

export const isConfigured = (provider: AIProvider): boolean => {
  if (provider === 'openai') {
    return AI_CONFIG.apiKeys.openai !== 'PLACEHOLDER_OPENAI_KEY';
  }
  if (provider === 'gemini') {
    return AI_CONFIG.apiKeys.googleAI !== 'PLACEHOLDER_GOOGLE_AI_KEY';
  }
  return false;
};

export const getProviderStatus = () => ({
  openai: {
    configured: isConfigured('openai'),
    features: {
      chat: isConfigured('openai'),
      realtime: AI_CONFIG.features.openaiRealtime && isConfigured('openai'),
      agents: isConfigured('openai'),
    },
  },
  gemini: {
    configured: isConfigured('gemini'),
    features: {
      chat: isConfigured('gemini'),
      live: AI_CONFIG.features.geminiLive && isConfigured('gemini'),
      search: AI_CONFIG.features.googleSearchGrounding,
    },
  },
  integrations: {
    googleMaps: AI_CONFIG.apiKeys.googleMaps !== 'PLACEHOLDER_MAPS_KEY',
    googleSearch: AI_CONFIG.apiKeys.googleSearch !== 'PLACEHOLDER_SEARCH_KEY',
    imageGeneration: AI_CONFIG.features.imageGeneration,
  },
});
