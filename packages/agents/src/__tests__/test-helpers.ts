/**
 * Test utilities and helpers for agent testing
 * 
 * Provides reusable mock factories and assertion helpers
 */

import { expect,vi } from 'vitest';

import type { AgentContext, AgentInput, AgentResult } from '../types/agent.types';

/**
 * Create a mock AgentInput with optional overrides
 */
export function createMockAgentInput(overrides?: Partial<AgentInput>): AgentInput {
  return {
    query: 'Test query',
    userId: 'test-user-123',
    context: {
      userId: 'test-user-123',
      source: 'whatsapp',
    },
    ...overrides,
  };
}

/**
 * Create a mock AgentContext with optional overrides
 */
export function createMockContext(overrides?: Partial<AgentContext>): AgentContext {
  return {
    userId: 'test-user-123',
    sessionId: `session-${Date.now()}`,
    source: 'whatsapp',
    ...overrides,
  };
}

/**
 * Create a mock successful tool result
 */
export function createMockToolResult(success: boolean, data?: any): { success: boolean; data?: any; error?: string } {
  if (success) {
    return {
      success: true,
      data: data ?? { message: 'Success' },
    };
  }
  return {
    success: false,
    error: data?.error ?? 'Operation failed',
  };
}

/**
 * Assert that an AgentResult has expected structure
 */
export function expectValidAgentResult(result: AgentResult): void {
  expect(result).toBeDefined();
  expect(typeof result.success).toBe('boolean');
  expect(typeof result.finalOutput).toBe('string');
  expect(typeof result.duration).toBe('number');
  expect(result.duration).toBeGreaterThanOrEqual(0);
  
  if (result.toolsInvoked) {
    expect(Array.isArray(result.toolsInvoked)).toBe(true);
  }
}

/**
 * Assert that an AgentResult indicates success
 */
export function expectSuccessfulAgentResult(result: AgentResult): void {
  expectValidAgentResult(result);
  expect(result.success).toBe(true);
  expect(result.finalOutput.length).toBeGreaterThan(0);
}

/**
 * Assert that an AgentResult indicates failure
 */
export function expectFailedAgentResult(result: AgentResult): void {
  expectValidAgentResult(result);
  expect(result.success).toBe(false);
}

/**
 * Create a mock tool definition
 */
export function createMockTool(name: string, executeFn?: (params: any, context: any) => Promise<any>) {
  return {
    name,
    description: `Mock ${name} tool for testing`,
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
      required: ['input'],
    },
    execute: executeFn ?? (async (params: any, context: any) => ({ success: true, input: params.input })),
  };
}

/**
 * Wait for async operations to complete
 */
export function waitForAsync(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock Supabase client for testing
 */
export function createMockSupabaseClient() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
}

/**
 * Mock WhatsApp message payload
 */
export function createMockWhatsAppMessage(text: string, from: string = '+250788123456') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-123',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+250123456789',
                phone_number_id: 'phone-123',
              },
              messages: [
                {
                  from,
                  id: `msg-${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: { body: text },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}
