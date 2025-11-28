/**
 * Unit tests for the Unified AI Provider
 */
import { describe, expect, it, vi } from 'vitest';
import {
  calculateCost,
  selectCostEffectiveModel,
  UnifiedAIProvider,
  type IUnifiedAIProvider,
  type ProviderHealthStatus,
  type UnifiedChatConfig,
  type UnifiedChatResponse,
  type UnifiedMessage,
  type UnifiedStreamChunk,
} from '../packages/ai/src/core/unified-provider';

// Mock provider for testing
function createMockProvider(name: 'openai' | 'gemini'): IUnifiedAIProvider {
  return {
    name,
    supportedModels: name === 'openai' 
      ? ['gpt-4o', 'gpt-4o-mini'] 
      : ['gemini-2.5-pro', 'gemini-2.5-flash'],
    
    chat: vi.fn().mockImplementation(async (): Promise<UnifiedChatResponse> => ({
      content: `Response from ${name}`,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: name === 'openai' ? 'gpt-4o' : 'gemini-2.5-flash',
      provider: name,
      latencyMs: 200,
      costUsd: 0.001,
    })),
    
    stream: vi.fn().mockImplementation(async function* (): AsyncGenerator<UnifiedStreamChunk> {
      yield { delta: 'Hello ', done: false };
      yield { delta: 'World', done: false };
      yield { delta: null, done: true, usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 } };
    }),
    
    embeddings: vi.fn().mockImplementation(async () => [0.1, 0.2, 0.3]),
    
    healthCheck: vi.fn().mockImplementation(async (): Promise<ProviderHealthStatus> => ({
      healthy: true,
      latencyMs: 100,
      lastChecked: new Date(),
    })),
  };
}

describe('UnifiedAIProvider', () => {
  describe('calculateCost', () => {
    it('calculates cost for GPT-4o correctly', () => {
      // 1000 prompt tokens + 500 completion tokens for GPT-4o
      // Pricing: $2.5/1M prompt, $10/1M completion
      // (1000/1M * 2.5) + (500/1M * 10) = 0.0025 + 0.005 = 0.0075
      const cost = calculateCost(1000, 500, 'gpt-4o');
      expect(cost).toBeCloseTo(0.0075, 6);
    });

    it('calculates cost for Gemini Flash-Lite correctly', () => {
      // Gemini is much cheaper
      const cost = calculateCost(1000, 500, 'gemini-2.5-flash-lite');
      expect(cost).toBeLessThan(0.001);
    });

    it('uses default pricing for unknown models', () => {
      const cost = calculateCost(1000, 500, 'unknown-model');
      // Should use gpt-4o pricing as fallback (0.0075)
      expect(cost).toBeCloseTo(0.0075, 6);
    });
  });

  describe('selectCostEffectiveModel', () => {
    it('selects flash-lite for simple/fast tasks on Gemini', () => {
      expect(selectCostEffectiveModel('simple', 'gemini')).toBe('gemini-2.5-flash-lite');
      expect(selectCostEffectiveModel('fast', 'gemini')).toBe('gemini-2.5-flash-lite');
    });

    it('selects pro model for complex tasks', () => {
      expect(selectCostEffectiveModel('complex', 'gemini')).toBe('gemini-2.5-pro');
      expect(selectCostEffectiveModel('complex', 'openai')).toBe('gpt-4o');
    });

    it('selects appropriate model for vision tasks', () => {
      expect(selectCostEffectiveModel('vision', 'gemini')).toBe('gemini-2.0-flash');
      expect(selectCostEffectiveModel('vision', 'openai')).toBe('gpt-4o');
    });

    it('selects mini/lite models for cost optimization', () => {
      expect(selectCostEffectiveModel('simple', 'openai')).toBe('gpt-4o-mini');
    });
  });

  describe('UnifiedAIProvider class', () => {
    it('creates provider with default configuration', () => {
      const provider = new UnifiedAIProvider({
        openaiApiKey: 'test-key',
      });
      expect(provider).toBeDefined();
    });

    it('uses primary provider for chat', async () => {
      const provider = new UnifiedAIProvider({
        openaiApiKey: 'test-key',
        primaryProvider: 'openai',
      });

      const mockOpenAI = createMockProvider('openai');
      provider.registerOpenAI(mockOpenAI);

      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const response = await provider.chat(messages);

      expect(response.provider).toBe('openai');
      expect(response.content).toBe('Response from openai');
      expect(mockOpenAI.chat).toHaveBeenCalledTimes(1);
    });

    it('falls back to secondary provider on failure', async () => {
      const provider = new UnifiedAIProvider({
        openaiApiKey: 'test-key',
        geminiApiKey: 'test-key',
        primaryProvider: 'openai',
        enableFallback: true,
        maxRetries: 0,
      });

      const mockOpenAI = createMockProvider('openai');
      const mockGemini = createMockProvider('gemini');

      // Make OpenAI fail
      mockOpenAI.chat = vi.fn().mockRejectedValue(new Error('API Error'));

      provider.registerOpenAI(mockOpenAI);
      provider.registerGemini(mockGemini);

      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const response = await provider.chat(messages);

      expect(response.provider).toBe('gemini');
      expect(mockOpenAI.chat).toHaveBeenCalled();
      expect(mockGemini.chat).toHaveBeenCalled();
    });

    it('throws when no provider is configured', async () => {
      const provider = new UnifiedAIProvider({});

      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      await expect(provider.chat(messages)).rejects.toThrow('No primary provider configured');
    });

    it('performs health check on all providers', async () => {
      const provider = new UnifiedAIProvider({
        openaiApiKey: 'test-key',
        geminiApiKey: 'test-key',
      });

      const mockOpenAI = createMockProvider('openai');
      const mockGemini = createMockProvider('gemini');

      provider.registerOpenAI(mockOpenAI);
      provider.registerGemini(mockGemini);

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.providers.openai?.healthy).toBe(true);
      expect(health.providers.gemini?.healthy).toBe(true);
    });

    it('fastResponse uses lightweight model', async () => {
      const provider = new UnifiedAIProvider({
        geminiApiKey: 'test-key',
        primaryProvider: 'gemini',
      });

      const mockGemini = createMockProvider('gemini');
      provider.registerGemini(mockGemini);

      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'Quick question' },
      ];

      await provider.fastResponse(messages);

      expect(mockGemini.chat).toHaveBeenCalledWith(
        messages,
        expect.objectContaining({
          model: 'gemini-2.5-flash-lite',
          temperature: 0.1,
          maxTokens: 256,
        }),
      );
    });

    it('streams responses correctly', async () => {
      const provider = new UnifiedAIProvider({
        openaiApiKey: 'test-key',
        primaryProvider: 'openai',
      });

      const mockOpenAI = createMockProvider('openai');
      provider.registerOpenAI(mockOpenAI);

      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const chunks: string[] = [];
      for await (const chunk of provider.stream(messages)) {
        if (chunk.delta) {
          chunks.push(chunk.delta);
        }
      }

      expect(chunks.join('')).toBe('Hello World');
    });
  });
});
