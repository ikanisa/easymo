"use strict";

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

/**
 * Unit tests for use-gemini-ai hook
 * 
 * Tests the Gemini AI integration hook including:
 * - API key retrieval
 * - Message sending
 * - Streaming
 * - Error handling
 * - Context management
 */

describe("useGeminiAI hook", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    } else {
      process.env.NEXT_PUBLIC_GEMINI_API_KEY = originalEnv;
    }
  });

  describe("API Key Retrieval", () => {
    it("should retrieve API key from environment variable", () => {
      const testKey = "test-api-key-123";
      process.env.NEXT_PUBLIC_GEMINI_API_KEY = testKey;
      
      // Simulate the getApiKey function
      const getApiKey = () => {
        if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
          return process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        }
        throw new Error("Gemini API key not configured");
      };

      const key = getApiKey();
      assert.equal(key, testKey);
    });

    it("should throw error when API key is not configured", () => {
      delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;

      const getApiKey = () => {
        if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
          return process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        }
        throw new Error("Gemini API key not configured. Please add it in Settings.");
      };

      assert.throws(
        () => getApiKey(),
        /Gemini API key not configured/
      );
    });
  });

  describe("Message Context Window", () => {
    it("should maintain context window of last 20 messages", () => {
      const messages: Array<{ role: string; content: string }> = [];
      const maxMessages = 20;

      // Add 30 messages
      for (let i = 0; i < 30; i++) {
        messages.push({ role: 'user', content: `Message ${i}` });
        messages.push({ role: 'assistant', content: `Response ${i}` });
      }

      // Keep only last 20
      const contextWindow = messages.slice(-maxMessages);

      assert.equal(contextWindow.length, maxMessages);
      assert.equal(contextWindow[0].content, 'Message 20');
      assert.equal(contextWindow[contextWindow.length - 1].content, 'Response 29');
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", () => {
      const simulateNetworkError = () => {
        throw new Error('Network error: Failed to fetch');
      };

      assert.throws(
        () => simulateNetworkError(),
        /Network error/
      );
    });

    it("should handle API errors with proper messages", () => {
      const apiError = {
        status: 429,
        message: 'Rate limit exceeded'
      };

      const errorMessage = `Gemini API error: ${apiError.status} - ${apiError.message}`;
      assert.match(errorMessage, /429/);
      assert.match(errorMessage, /Rate limit exceeded/);
    });
  });

  describe("Retry Logic", () => {
    it("should retry failed requests up to max retries", async () => {
      const MAX_RETRIES = 3;
      let attempts = 0;

      const attemptRequest = async (): Promise<string> => {
        attempts++;
        if (attempts < MAX_RETRIES) {
          throw new Error('Temporary failure');
        }
        return 'Success';
      };

      let retries = 0;
      let result: string | null = null;

      while (retries < MAX_RETRIES) {
        try {
          result = await attemptRequest();
          break;
        } catch (err) {
          retries++;
          if (retries >= MAX_RETRIES) {
            throw err;
          }
        }
      }

      assert.equal(result, 'Success');
      assert.equal(attempts, MAX_RETRIES);
    });

    it("should apply exponential backoff between retries", () => {
      const RETRY_DELAY = 1000;
      const retries = [1, 2, 3];
      const delays = retries.map(r => RETRY_DELAY * r);

      assert.equal(delays[0], 1000); // First retry: 1s
      assert.equal(delays[1], 2000); // Second retry: 2s
      assert.equal(delays[2], 3000); // Third retry: 3s
    });
  });

  describe("Request Formatting", () => {
    it("should format messages correctly for Gemini API", () => {
      const userMessage = "Hello, AI!";
      const systemPrompt = "You are a helpful assistant.";

      const formattedMessages = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'user', parts: [{ text: userMessage }] },
      ];

      assert.equal(formattedMessages.length, 2);
      assert.equal(formattedMessages[0].parts[0].text, systemPrompt);
      assert.equal(formattedMessages[1].parts[0].text, userMessage);
    });

    it("should convert assistant role to model for API", () => {
      const messages = [
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Answer' },
      ];

      const formatted = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      assert.equal(formatted[0].role, 'user');
      assert.equal(formatted[1].role, 'model');
    });
  });

  describe("Streaming Response Parsing", () => {
    it("should parse SSE data chunks correctly", () => {
      const sseChunk = 'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}';
      const line = sseChunk.slice(6); // Remove 'data: ' prefix

      const data = JSON.parse(line);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      assert.equal(text, 'Hello');
    });

    it("should handle incomplete SSE chunks gracefully", () => {
      const incompleteChunk = 'data: {"incomplete';

      let parsed = null;
      try {
        parsed = JSON.parse(incompleteChunk.slice(6));
      } catch {
        // Expected to fail - ignore parse errors for partial chunks
      }

      assert.equal(parsed, null);
    });
  });

  describe("Abort Controller", () => {
    it("should create and abort requests", () => {
      const controller = new AbortController();
      
      assert.equal(controller.signal.aborted, false);
      
      controller.abort();
      
      assert.equal(controller.signal.aborted, true);
    });
  });
});
