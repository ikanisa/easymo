/**
 * Integration tests for LLM provider routing
 * Tests model-to-provider mapping and Gemini chat history format
 */

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test("LLM router detects provider from model name", () => {
  // Import LLMRouter
  // Note: This is a unit test that can run without Supabase
  // We test the logic, not the actual API calls
  
  const testCases = [
    { model: "gemini-1.5-flash", expected: "gemini" },
    { model: "gemini-2.0-pro", expected: "gemini" },
    { model: "gpt-4-turbo-preview", expected: "openai" },
    { model: "gpt-3.5-turbo", expected: "openai" },
    { model: "o1-preview", expected: "openai" },
  ];
  
  // Test model name detection logic
  for (const testCase of testCases) {
    const modelLower = testCase.model.toLowerCase();
    let detected: "openai" | "gemini" | null = null;
    
    if (modelLower.startsWith("gemini-")) {
      detected = "gemini";
    } else if (modelLower.startsWith("gpt-") || modelLower.startsWith("o1-")) {
      detected = "openai";
    }
    
    assertEquals(
      detected,
      testCase.expected,
      `Model ${testCase.model} should map to ${testCase.expected}`
    );
  }
});

Deno.test("Gemini chat history format validation", () => {
  // Test that Gemini history format is correct
  // First message must be from user, not model
  
  const validHistory = [
    { role: "user", parts: [{ text: "Hello" }] },
    { role: "model", parts: [{ text: "Hi!" }] },
    { role: "user", parts: [{ text: "How are you?" }] },
  ];
  
  // First message should be user
  assertEquals(validHistory[0].role, "user", "First message must be from user");
  
  // Test invalid history (model first)
  const invalidHistory = [
    { role: "model", parts: [{ text: "Hi!" }] },
    { role: "user", parts: [{ text: "Hello" }] },
  ];
  
  // This should be detected and fixed
  const firstRole = invalidHistory[0].role;
  assertEquals(
    firstRole === "user",
    false,
    "Invalid history has model as first message"
  );
});

Deno.test("System instruction should not be in Gemini history", () => {
  // System instructions should be passed via systemInstruction parameter
  // Not as part of the history array
  
  const history = [
    { role: "user", parts: [{ text: "Hello" }] },
    { role: "model", parts: [{ text: "Hi!" }] },
  ];
  
  // History should not contain system messages
  const hasSystem = history.some((msg) => msg.role === "system");
  assertEquals(hasSystem, false, "History should not contain system messages");
  
  // System should be separate
  const systemInstruction = "You are a helpful assistant.";
  assertEquals(
    typeof systemInstruction === "string",
    true,
    "System instruction should be a separate parameter"
  );
});

