/**
 * Agent Base Tests
 *
 * Tests for the AgentBase class functionality.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

import { AgentBase, AgentConfig, AgentInput, AgentResult } from '../src/core/agent-base.js';
import type { Tool } from '../src/core/types.js';

// Mock childLogger
vi.mock('@easymo/commons', () => ({
  childLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

/**
 * Concrete implementation of AgentBase for testing
 */
class TestAgent extends AgentBase {
  readonly name = 'Test Agent';
  readonly slug = 'test';
  readonly instructions = 'You are a test agent.';
  readonly tools: Tool[] = [];

  async execute(input: AgentInput): Promise<AgentResult> {
    return {
      message: `Processed: ${input.message}`,
      model: this.model,
    };
  }
}

describe('AgentBase', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent();
  });

  describe('initialization', () => {
    it('should create an agent with default config', () => {
      expect(agent.name).toBe('Test Agent');
      expect(agent.slug).toBe('test');
      expect(agent.instructions).toBe('You are a test agent.');
    });

    it('should accept custom config', () => {
      const config: AgentConfig = {
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 2048,
        maxTurns: 10,
        enableTracing: false,
      };

      const customAgent = new TestAgent(config);
      // The config values should be applied internally
      expect(customAgent).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should process input and return result', async () => {
      const input: AgentInput = {
        message: 'Hello',
        userId: 'user-123',
        conversationId: 'conv-456',
      };

      const result = await agent.execute(input);

      expect(result.message).toBe('Processed: Hello');
      expect(result.model).toBeDefined();
    });

    it('should handle context in input', async () => {
      const input: AgentInput = {
        message: 'Test',
        userId: 'user-123',
        conversationId: 'conv-456',
        context: { key: 'value' },
      };

      const result = await agent.execute(input);

      expect(result).toBeDefined();
    });
  });

  describe('tools', () => {
    it('should have empty tools array by default', () => {
      expect(agent.tools).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      class FailingAgent extends AgentBase {
        readonly name = 'Failing Agent';
        readonly slug = 'failing';
        readonly instructions = 'This agent fails.';
        readonly tools: Tool[] = [];

        async execute(_input: AgentInput): Promise<AgentResult> {
          throw new Error('Intentional error');
        }
      }

      const failingAgent = new FailingAgent();
      const input: AgentInput = {
        message: 'test',
        userId: 'user-123',
        conversationId: 'conv-456',
      };

      await expect(failingAgent.execute(input)).rejects.toThrow('Intentional error');
    });
  });
});
