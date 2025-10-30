/**
 * Tests for BookingAgent
 */

import { describe, it, expect, vi } from 'vitest';
import { BookingAgent } from './booking';
import { runAgent } from '../runner';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{
              message: {
                role: 'assistant',
                content: 'I can help you check availability for booking.',
              },
            }],
          }),
        },
      },
    })),
  };
});

// Mock environment
process.env.OPENAI_API_KEY = 'test-key';
process.env.FEATURE_AGENTS_BOOKING = 'true';

describe('BookingAgent', () => {
  it('should have correct configuration', () => {
    expect(BookingAgent.name).toBe('BookingAgent');
    expect(BookingAgent.model).toBe('gpt-4o');
    expect(BookingAgent.tools).toBeDefined();
    expect(BookingAgent.tools?.length).toBeGreaterThan(0);
  });

  it('should include required tools', () => {
    const toolNames = BookingAgent.tools?.map(t => t.name) || [];
    expect(toolNames).toContain('CheckAvailability');
    expect(toolNames).toContain('CreateBooking');
    expect(toolNames).toContain('MenuLookup');
  });

  it('should execute successfully with valid input', async () => {
    const result = await runAgent(BookingAgent, {
      userId: 'test-user-123',
      query: 'Show me available time slots',
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.finalOutput).toBeTruthy();
  });

  it('should handle errors gracefully', async () => {
    // Test with invalid user ID format
    const result = await runAgent(BookingAgent, {
      userId: '', // Invalid
      query: 'test',
    });

    expect(result).toBeDefined();
    // Should still return a result object even if execution fails
  });
});
