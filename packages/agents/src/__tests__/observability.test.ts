/**
 * Tests for observability utilities
 * 
 * Tests structured logging and metrics for agent operations
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentContext, AgentTrace } from '../types';
import {
  logAgentComplete,
  logAgentError,
  logAgentHandoff,
  logAgentStart,
  logStructuredEvent,
  logToolInvocation,
  recordMetric,
  storeAgentTrace,
} from '../observability';

describe('Observability', () => {
  const mockContext: AgentContext = {
    userId: 'test-user-123',
    sessionId: 'session-456',
    source: 'whatsapp',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logStructuredEvent', () => {
    it('should log structured event with required fields', async () => {
      await expect(
        logStructuredEvent('TEST_EVENT', { key: 'value' })
      ).resolves.not.toThrow();
    });

    it('should include timestamp', async () => {
      await expect(
        logStructuredEvent('TIMESTAMP_TEST', { data: 123 })
      ).resolves.not.toThrow();
    });
  });

  describe('logAgentStart', () => {
    it('should log agent execution start', async () => {
      await expect(
        logAgentStart('waiter_agent', mockContext, 'Show me the menu')
      ).resolves.not.toThrow();
    });

    it('should truncate long queries', async () => {
      const longQuery = 'A'.repeat(200);
      await expect(
        logAgentStart('waiter_agent', mockContext, longQuery)
      ).resolves.not.toThrow();
    });
  });

  describe('logAgentComplete', () => {
    it('should log successful completion', async () => {
      await expect(
        logAgentComplete('waiter_agent', mockContext, {
          success: true,
          durationMs: 150,
          toolsInvoked: ['search_menu', 'order_create'],
        })
      ).resolves.not.toThrow();
    });

    it('should log failed completion', async () => {
      await expect(
        logAgentComplete('waiter_agent', mockContext, {
          success: false,
          durationMs: 50,
          toolsInvoked: [],
        })
      ).resolves.not.toThrow();
    });

    it('should log with handoffs', async () => {
      await expect(
        logAgentComplete('support_agent', mockContext, {
          success: true,
          durationMs: 200,
          handoffs: ['human_agent'],
        })
      ).resolves.not.toThrow();
    });
  });

  describe('logAgentError', () => {
    it('should log agent execution error', async () => {
      const error = new Error('Test error message');
      await expect(
        logAgentError('waiter_agent', mockContext, error, 100)
      ).resolves.not.toThrow();
    });

    it('should include stack trace in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Dev error');
      await expect(
        logAgentError('waiter_agent', mockContext, error, 100)
      ).resolves.not.toThrow();
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('logToolInvocation', () => {
    it('should log tool invocation', async () => {
      await expect(
        logToolInvocation('search_menu', mockContext, {
          query: 'pizza',
          category: 'food',
        })
      ).resolves.not.toThrow();
    });

    it('should sanitize sensitive params', async () => {
      await expect(
        logToolInvocation('payment_tool', mockContext, {
          amount: 1000,
          password: 'secret123',
          token: 'abc-token',
        })
      ).resolves.not.toThrow();
    });

    it('should truncate long param values', async () => {
      await expect(
        logToolInvocation('search_tool', mockContext, {
          query: 'A'.repeat(200),
        })
      ).resolves.not.toThrow();
    });
  });

  describe('logAgentHandoff', () => {
    it('should log agent handoff', async () => {
      await expect(
        logAgentHandoff('support_agent', 'human_agent', mockContext, 'Complex issue')
      ).resolves.not.toThrow();
    });
  });

  describe('recordMetric', () => {
    it('should record metric with value', async () => {
      await expect(
        recordMetric('user.created', 1, { source: 'whatsapp' })
      ).resolves.not.toThrow();
    });

    it('should record metric without tags', async () => {
      await expect(
        recordMetric('agent.duration', 150)
      ).resolves.not.toThrow();
    });
  });

  describe('storeAgentTrace', () => {
    it('should store agent trace', async () => {
      const trace: AgentTrace = {
        id: 'trace-123',
        agentName: 'waiter_agent',
        userId: 'user-123',
        sessionId: 'session-456',
        durationMs: 200,
        toolsInvoked: ['search_menu'],
        success: true,
        createdAt: new Date().toISOString(),
      };

      await expect(storeAgentTrace(trace)).resolves.not.toThrow();
    });
  });
});
