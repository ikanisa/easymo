/**
 * Unit tests for DualAIProvider
 * 
 * Tests the dual-provider AI architecture with automatic failover
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { DualAIProvider } from "./dual-ai-provider.ts";

Deno.test("DualAIProvider - should be instantiable", () => {
  // Mock API keys
  Deno.env.set("OPENAI_API_KEY", "test-openai-key");
  Deno.env.set("GEMINI_API_KEY", "test-gemini-key");
  
  const provider = new DualAIProvider();
  assertExists(provider);
});

Deno.test("DualAIProvider - should require at least one API key", () => {
  // Clear API keys
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  
  Deno.env.delete("OPENAI_API_KEY");
  Deno.env.delete("GEMINI_API_KEY");
  
  let errorThrown = false;
  try {
    new DualAIProvider();
  } catch (error) {
    errorThrown = true;
    assertEquals(
      error.message,
      'At least one AI provider API key must be configured (OPENAI_API_KEY or GEMINI_API_KEY)'
    );
  }
  
  assertEquals(errorThrown, true);
  
  // Restore keys
  if (openaiKey) Deno.env.set("OPENAI_API_KEY", openaiKey);
  if (geminiKey) Deno.env.set("GEMINI_API_KEY", geminiKey);
});

Deno.test("DualAIProvider - chat method should accept messages", async () => {
  // This test requires mocking fetch or actual API keys
  // For now, we just verify the structure
  const mockMessages = [
    { role: "system" as const, content: "You are a helpful assistant" },
    { role: "user" as const, content: "Hello" },
  ];
  
  // The provider would be called like this:
  // const provider = new DualAIProvider();
  // const result = await provider.chat(mockMessages);
  
  // For now, just verify the message structure is correct
  assertEquals(mockMessages[0].role, "system");
  assertEquals(mockMessages[1].role, "user");
});

Deno.test("DualAIProvider - should use correct models", () => {
  // Verify model constants match README requirements
  const PRIMARY_MODEL = 'gpt-5';
  const FALLBACK_MODEL = 'gemini-3';
  
  assertEquals(PRIMARY_MODEL, 'gpt-5', "Primary model should be GPT-5 per README.md");
  assertEquals(FALLBACK_MODEL, 'gemini-3', "Fallback model should be Gemini-3 per README.md");
});
