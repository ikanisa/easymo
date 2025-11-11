/**
 * Synthetic Failure Test Suite for Agent Fallbacks
 * Phase 3: Exercise and Harden Fallbacks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleAgentFallback,
  ForcedFallbackError,
  withSyntheticFailure,
} from '../lib/server/agent-fallback-handler';

// Mock observability functions
vi.mock('../lib/server/logger', () => ({
  logStructured: vi.fn(),
}));

vi.mock('../lib/server/metrics', () => ({
  emitMetric: vi.fn(),
}));

describe('Agent Fallback Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Driver Negotiation Agent', () => {
    it('should use ranking service fallback', async () => {
      const mockRankingData = [
        { id: 1, driver: 'John Doe', price: 5000 },
        { id: 2, driver: 'Jane Smith', price: 4500 },
      ];

      const result = await handleAgentFallback({
        agentName: 'driver-negotiation',
        userId: 'test-user',
        originalError: new ForcedFallbackError(),
      }, {
        rankingService: async () => mockRankingData,
      });

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe('ranking_service');
      expect(result.data).toEqual(mockRankingData);
    });

    it('should fallback to Supabase when ranking fails', async () => {
      const mockSupabaseData = [
        { id: 3, driver: 'Bob Wilson', price: 5500 },
      ];

      const result = await handleAgentFallback({
        agentName: 'driver-negotiation',
        originalError: new Error('AI failed'),
      }, {
        rankingService: async () => { throw new Error('Ranking unavailable'); },
        supabaseBackup: async () => mockSupabaseData,
      });

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe('supabase_backup');
    });
  });

  describe('All Agents Error Messages', () => {
    const agents = [
      'driver-negotiation',
      'pharmacy',
      'shops-services',
      'hardware',
      'property-rental',
      'schedule-trip',
      'marketplace',
    ];

    agents.forEach((agentName) => {
      it(`should provide friendly message for ${agentName}`, async () => {
        const result = await handleAgentFallback({
          agentName,
          originalError: new Error('Test failure'),
        }, {});

        expect(result.success).toBe(false);
        expect(result.userMessage).toBeTruthy();
        expect(result.shouldRetry).toBe(true);
      });
    });
  });
});
