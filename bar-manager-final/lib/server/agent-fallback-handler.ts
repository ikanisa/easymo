/**
 * Centralized Agent Fallback Handler
 * Phase 3: Exercise and Harden Fallbacks
 * 
 * Provides unified fallback logic for all AI agents with:
 * - Mock data fallbacks
 * - Ranking service integration
 * - Supabase backup queries
 * - User-friendly error messages
 * - Observability/metrics
 */

import { logStructured } from './logger';
import { emitMetric } from './metrics';

export interface FallbackOptions {
  agentName: string;
  userId?: string;
  sessionId?: string;
  originalError: Error;
  context?: Record<string, any>;
}

export interface FallbackResult<T> {
  success: boolean;
  data?: T;
  fallbackUsed: string;
  userMessage: string;
  shouldRetry: boolean;
}

/**
 * Generic fallback handler with tiered strategy:
 * 1. Try ranking service (if applicable)
 * 2. Try Supabase backup query
 * 3. Return curated mock data
 * 4. Return graceful error message
 */
export async function handleAgentFallback<T>(
  options: FallbackOptions,
  fallbackStrategies: {
    rankingService?: () => Promise<T>;
    supabaseBackup?: () => Promise<T>;
    mockData?: () => T;
  }
): Promise<FallbackResult<T>> {
  const { agentName, userId, sessionId, originalError, context } = options;

  logStructured({
    event: 'AGENT_FALLBACK_TRIGGERED',
    agentName,
    userId,
    sessionId,
    error: originalError.message,
    context,
  });

  emitMetric(`agent.${agentName}.fallback.triggered`, 1);

  // Strategy 1: Ranking service
  if (fallbackStrategies.rankingService) {
    try {
      const data = await fallbackStrategies.rankingService();
      logStructured({
        event: 'AGENT_FALLBACK_SUCCESS',
        agentName,
        strategy: 'ranking_service',
      });
      emitMetric(`agent.${agentName}.fallback.ranking_success`, 1);
      
      return {
        success: true,
        data,
        fallbackUsed: 'ranking_service',
        userMessage: 'Showing top-ranked results',
        shouldRetry: false,
      };
    } catch (rankingError) {
      logStructured({
        event: 'AGENT_FALLBACK_RANKING_FAILED',
        agentName,
        error: rankingError instanceof Error ? rankingError.message : 'Unknown',
      });
    }
  }

  // Strategy 2: Supabase backup
  if (fallbackStrategies.supabaseBackup) {
    try {
      const data = await fallbackStrategies.supabaseBackup();
      logStructured({
        event: 'AGENT_FALLBACK_SUCCESS',
        agentName,
        strategy: 'supabase_backup',
      });
      emitMetric(`agent.${agentName}.fallback.supabase_success`, 1);
      
      return {
        success: true,
        data,
        fallbackUsed: 'supabase_backup',
        userMessage: 'Showing available options',
        shouldRetry: false,
      };
    } catch (supabaseError) {
      logStructured({
        event: 'AGENT_FALLBACK_SUPABASE_FAILED',
        agentName,
        error: supabaseError instanceof Error ? supabaseError.message : 'Unknown',
      });
    }
  }

  // Strategy 3: Mock data
  if (fallbackStrategies.mockData) {
    try {
      const data = fallbackStrategies.mockData();
      logStructured({
        event: 'AGENT_FALLBACK_SUCCESS',
        agentName,
        strategy: 'mock_data',
      });
      emitMetric(`agent.${agentName}.fallback.mock_success`, 1);
      
      return {
        success: true,
        data,
        fallbackUsed: 'mock_data',
        userMessage: 'Showing example results. Please try again later for personalized recommendations.',
        shouldRetry: true,
      };
    } catch (mockError) {
      logStructured({
        event: 'AGENT_FALLBACK_MOCK_FAILED',
        agentName,
        error: mockError instanceof Error ? mockError.message : 'Unknown',
      });
    }
  }

  // Strategy 4: Graceful failure
  logStructured({ event: 'AGENT_FALLBACK_ALL_FAILED', agentName });
  emitMetric(`agent.${agentName}.fallback.all_failed`, 1);
  
  return {
    success: false,
    fallbackUsed: 'none',
    userMessage: getUserFriendlyErrorMessage(agentName),
    shouldRetry: true,
  };
}

/**
 * Generate user-friendly error messages per agent type
 */
function getUserFriendlyErrorMessage(agentName: string): string {
  const messages: Record<string, string> = {
    'driver-negotiation': 'Unable to process driver request. Please try again or contact support.',
    'pharmacy': 'Pharmacy service temporarily unavailable. Please try again shortly.',
    'shops-services': 'Shop search unavailable. Please try again or browse manually.',
    'hardware': 'Hardware catalog temporarily unavailable. Please try again.',
    'property-rental': 'Property search unavailable. Please contact us for assistance.',
    'schedule-trip': 'Trip scheduling unavailable. Please try booking directly.',
    'marketplace': 'Marketplace search unavailable. Please browse categories manually.',
    'video-analysis': 'Video processing unavailable. Please try again later.',
    'insurance-ocr': 'Document processing unavailable. Please upload again later.',
    'momo-allocation': 'Payment processing unavailable. Please try another method.',
  };

  return messages[agentName] || 'Service temporarily unavailable. Please try again later.';
}

/**
 * Test helper to force fallback (for synthetic failure tests)
 */
export class ForcedFallbackError extends Error {
  constructor(message = 'Synthetic failure for testing') {
    super(message);
    this.name = 'ForcedFallbackError';
  }
}

/**
 * Middleware to inject synthetic failures for testing
 */
export function withSyntheticFailure<T>(
  fn: () => Promise<T>,
  shouldFail: boolean
): Promise<T> {
  if (shouldFail && process.env.NODE_ENV === 'development') {
    return Promise.reject(new ForcedFallbackError());
  }
  return fn();
}
