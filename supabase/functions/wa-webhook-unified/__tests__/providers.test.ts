/**
 * Unit Tests for AI Provider Factory
 */

import { assertEquals, assertExists, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Test AIProviderFactory exports and types
Deno.test("AIProviderFactory: should export required types", async () => {
  const module = await import("../core/providers/index.ts");
  assertExists(module.AIProviderFactory);
  assertExists(module.GeminiProvider);
  assertExists(module.OpenAIProvider);
});

Deno.test("AIProviderFactory: getProviderInfo should return correct info", async () => {
  const { AIProviderFactory } = await import("../core/providers/index.ts");
  const info = AIProviderFactory.getProviderInfo();
  
  assertEquals(info.primary, "gemini-2.5-pro");
  assertEquals(info.secondary, "gpt-5");
  assertExists(info.defaultProvider);
  assertExists(info.fallbackEnabled);
});

Deno.test("GeminiProvider: should have correct name and model", async () => {
  // Skip if no API key (test environment)
  if (!Deno.env.get("GEMINI_API_KEY")) {
    console.log("Skipping GeminiProvider test - no API key");
    return;
  }
  
  const { GeminiProvider } = await import("../core/providers/gemini.ts");
  const provider = new GeminiProvider();
  
  assertEquals(provider.name, "gemini");
  assertEquals(provider.model, "gemini-2.5-pro");
});

Deno.test("OpenAIProvider: should have correct name and model", async () => {
  // Skip if no API key (test environment)
  if (!Deno.env.get("OPENAI_API_KEY")) {
    console.log("Skipping OpenAIProvider test - no API key");
    return;
  }
  
  const { OpenAIProvider } = await import("../core/providers/openai.ts");
  const provider = new OpenAIProvider();
  
  assertEquals(provider.name, "openai");
  assertEquals(provider.model, "gpt-5");
});
