/**
 * Unit tests for agent.ts (Buy & Sell Agent)
 * 
 * P2-010: Missing Unit Tests - Add unit tests for handlers and utilities
 * 
 * Run with: deno test --allow-env --allow-net agent.test.ts
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getWelcomeMessage,
  getGreetingMessage,
  BUSINESS_CATEGORIES,
} from "./agent.ts";

Deno.test("Agent - getWelcomeMessage returns English message for 'en' locale", async () => {
  const message = await getWelcomeMessage("en");
  assertExists(message);
  assertEquals(typeof message, "string");
  assertEquals(message.includes("Kwizera"), true);
  assertEquals(message.includes("easyMO"), true);
});

Deno.test("Agent - getWelcomeMessage returns French message for 'fr' locale", async () => {
  const message = await getWelcomeMessage("fr");
  assertExists(message);
  assertEquals(typeof message, "string");
  assertEquals(message.includes("Kwizera"), true);
  assertEquals(message.includes("easyMO"), true);
});

Deno.test("Agent - getWelcomeMessage maps 'rw' to 'en' locale", async () => {
  const message = await getWelcomeMessage("rw");
  assertExists(message);
  assertEquals(typeof message, "string");
  // Should return English message (not Kinyarwanda)
  assertEquals(message.includes("Kwizera"), true);
});

Deno.test("Agent - getGreetingMessage returns English greeting for 'en' locale", async () => {
  const message = await getGreetingMessage("en");
  assertExists(message);
  assertEquals(typeof message, "string");
  assertEquals(message.includes("Buy & Sell"), true);
});

Deno.test("Agent - getGreetingMessage returns French greeting for 'fr' locale", async () => {
  const message = await getGreetingMessage("fr");
  assertExists(message);
  assertEquals(typeof message, "string");
  assertEquals(message.includes("Acheter & Vendre"), true);
});

Deno.test("Agent - getGreetingMessage maps 'rw' to 'en' locale", async () => {
  const message = await getGreetingMessage("rw");
  assertExists(message);
  assertEquals(typeof message, "string");
  // Should return English greeting
  assertEquals(message.includes("Buy & Sell"), true);
});

Deno.test("Agent - BUSINESS_CATEGORIES contains expected categories", () => {
  assertExists(BUSINESS_CATEGORIES);
  assertEquals(Array.isArray(BUSINESS_CATEGORIES), true);
  assertEquals(BUSINESS_CATEGORIES.length > 0, true);
  
  // Check for expected categories
  const categoryCodes = BUSINESS_CATEGORIES.map(c => c.code);
  assertEquals(categoryCodes.includes("pharmacy"), true);
  assertEquals(categoryCodes.includes("restaurant"), true);
  assertEquals(categoryCodes.includes("supermarket"), true);
  
  // Check category structure
  const firstCategory = BUSINESS_CATEGORIES[0];
  assertExists(firstCategory.code);
  assertExists(firstCategory.name);
  assertExists(firstCategory.icon);
  assertExists(firstCategory.description);
});

Deno.test("Agent - getWelcomeMessage defaults to English when locale is undefined", async () => {
  const message = await getWelcomeMessage(undefined as any);
  assertExists(message);
  assertEquals(typeof message, "string");
  assertEquals(message.includes("Kwizera"), true);
});

Deno.test("Agent - getGreetingMessage defaults to English when locale is undefined", async () => {
  const message = await getGreetingMessage(undefined as any);
  assertExists(message);
  assertEquals(typeof message, "string");
  assertEquals(message.includes("Buy & Sell"), true);
});

console.log("✅ Buy & Sell Agent tests loaded");

