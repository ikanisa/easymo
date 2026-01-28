/**
 * Tests for BaseAgent class
 * 
 * Tests the abstract base class functionality including:
 * - Session management
 * - Timeout handling  
 * - Tool execution
 * - LLM client initialization
 */

import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentContext,AgentInput, AgentResult, Tool } from '../../types/agent.types';
import { BaseAgent } from '../base/agent.base';

// Concrete implementation for testing the abstract class
class TestAgent extends BaseAgent {
  name = 'test_agent';
  instructions = 'Test instructions for testing';
  tools: Tool[] = [
    {
      name: 'test_tool',
      description: 'A test tool',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string' }
        },
        required: ['input']
      },
      execute: vi.fn(async (params, context) => ({ success: true, input: params.input }))
    }
  ];

  async execute(input: AgentInput): Promise<AgentResult> {
    return {
      success: true,
      finalOutput: 'Test output',
      data: {},
      toolsInvoked: [],
      duration: 0
    };
  }

  protected formatSingleOption(option: any): string {
    return `Option: ${option.name}`;
  }

  protected calculateScore(option: any, criteria: any): number {
    return 1;
  }

  // Expose protected methods for testing
  public testCreateSession(userId: string, agentType: string, deadlineMs?: number) {
    return this.createSession(userId, agentType, deadlineMs);
  }

  public testExtendDeadline(session: any, additionalMs: number) {
    return this.extendDeadline(session, additionalMs);
  }

  public testAddResult(session: any, result: any) {
    return this.addResult(session, result);
  }

  public testCompleteSession(session: any) {
    return this.completeSession(session);
  }

  public testExecuteTool(toolName: string, params: any, context: AgentContext) {
    return this.executeTool(toolName, params, context);
  }

  public testFormatOptions(options: any[]) {
    return this.formatOptions(options);
  }

  public getActiveSessions() {
    return this.activeSessions;
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new TestAgent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default model', () => {
      expect(agent.model).toBe('gemini-1.5-flash');
    });

    it('should initialize with default temperature', () => {
      expect(agent.temperature).toBe(0.7);
    });

    it('should initialize with default maxTokens', () => {
      expect(agent.maxTokens).toBe(2000);
    });

    it('should be an EventEmitter', () => {
      expect(agent).toBeInstanceOf(EventEmitter);
    });

    it('should initialize empty active sessions', () => {
      expect(agent.getActiveSessions().size).toBe(0);
    });
  });

  describe('session management', () => {
    it('should create a new session', () => {
      const session = agent.testCreateSession('user-123', 'test_agent');

      expect(session).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.agentType).toBe('test_agent');
      expect(session.status).toBe('active');
      expect(session.results).toEqual([]);
      expect(session.extensions).toBe(0);
    });

    it('should create session with deadline', () => {
      const session = agent.testCreateSession('user-123', 'test_agent', 5000);

      expect(session.deadline).toBeDefined();
      expect(session.deadline).toBeGreaterThan(Date.now());
    });

    it('should create session without deadline', () => {
      const session = agent.testCreateSession('user-123', 'test_agent');

      expect(session.deadline).toBeUndefined();
    });

    it('should generate unique session id', () => {
      const session1 = agent.testCreateSession('user-1', 'test_agent');
      const session2 = agent.testCreateSession('user-2', 'test_agent');

      expect(session1.id).not.toBe(session2.id);
    });

    it('should add session to active sessions', () => {
      const session = agent.testCreateSession('user-123', 'test_agent');

      expect(agent.getActiveSessions().has(session.id)).toBe(true);
    });
  });

  describe('deadline extension', () => {
    it('should extend deadline when under limit', () => {
      const session = agent.testCreateSession('user-123', 'test_agent', 5000);
      const originalDeadline = session.deadline!;

      const result = agent.testExtendDeadline(session, 2000);

      expect(result).toBe(true);
      expect(session.deadline).toBe(originalDeadline + 2000);
      expect(session.extensions).toBe(1);
    });

    it('should not extend deadline when at limit', () => {
      const session = agent.testCreateSession('user-123', 'test_agent', 5000);
      session.extensions = 2;

      const result = agent.testExtendDeadline(session, 2000);

      expect(result).toBe(false);
    });

    it('should not extend deadline when no deadline exists', () => {
      const session = agent.testCreateSession('user-123', 'test_agent');

      const result = agent.testExtendDeadline(session, 2000);

      expect(result).toBe(false);
    });
  });

  describe('result management', () => {
    it('should add result to session', () => {
      const session = agent.testCreateSession('user-123', 'test_agent');

      agent.testAddResult(session, { id: 1, name: 'Result 1' });

      expect(session.results).toHaveLength(1);
      expect(session.results[0]).toEqual({ id: 1, name: 'Result 1' });
    });

    it('should emit threshold_reached when 3 results added', () => {
      const session = agent.testCreateSession('user-123', 'test_agent');
      const thresholdCallback = vi.fn();
      agent.on('threshold_reached', thresholdCallback);

      agent.testAddResult(session, { id: 1 });
      agent.testAddResult(session, { id: 2 });
      agent.testAddResult(session, { id: 3 });

      expect(thresholdCallback).toHaveBeenCalledTimes(1);
      expect(thresholdCallback).toHaveBeenCalledWith({
        sessionId: session.id,
        results: session.results,
      });
    });
  });

  describe('session completion', () => {
    it('should complete session and remove from active', () => {
      const session = agent.testCreateSession('user-123', 'test_agent');

      agent.testCompleteSession(session);

      expect(session.status).toBe('completed');
      expect(agent.getActiveSessions().has(session.id)).toBe(false);
    });
  });

  describe('tool execution', () => {
    it('should execute registered tool', async () => {
      const context: AgentContext = { userId: 'user-123', source: 'web' };
      
      const result = await agent.testExecuteTool('test_tool', { input: 'test' }, context);

      expect(result).toEqual({ success: true, input: 'test' });
    });

    it('should throw error for unknown tool', async () => {
      const context: AgentContext = { userId: 'user-123', source: 'web' };

      await expect(
        agent.testExecuteTool('unknown_tool', {}, context)
      ).rejects.toThrow('Tool unknown_tool not found');
    });
  });

  describe('format options', () => {
    it('should format multiple options', () => {
      const options = [
        { name: 'Option A' },
        { name: 'Option B' },
        { name: 'Option C' },
      ];

      const formatted = agent.testFormatOptions(options);

      expect(formatted).toContain('*Option 1*');
      expect(formatted).toContain('*Option 2*');
      expect(formatted).toContain('*Option 3*');
      expect(formatted).toContain('Reply with the option number');
    });

    it('should limit to 3 options', () => {
      const options = [
        { name: 'Option A' },
        { name: 'Option B' },
        { name: 'Option C' },
        { name: 'Option D' },
      ];

      const formatted = agent.testFormatOptions(options);

      expect(formatted).toContain('*Option 3*');
      expect(formatted).not.toContain('*Option 4*');
    });
  });

  describe('execute', () => {
    it('should return success result', async () => {
      const input: AgentInput = {
        query: 'test query',
        userId: 'user-123',
      };

      const result = await agent.execute(input);

      expect(result.success).toBe(true);
      expect(result.finalOutput).toBe('Test output');
    });
  });
});
