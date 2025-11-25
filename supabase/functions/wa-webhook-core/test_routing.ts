#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Routing Test Script for wa-webhook-core
 * Tests keyword-based routing using the consolidated route config
 */

import { matchKeywordsToService } from "../_shared/route-config.ts";

// Use the consolidated route matching function
function routeMessage(messageText: string): string {
  const matched = matchKeywordsToService(messageText);
  return matched ?? "wa-webhook-core"; // Default to core if no match
}

// Test cases - updated to use consolidated service names
const tests = [
  // Insurance
  { input: "I need motor insurance", expected: "wa-webhook-insurance" },
  { input: "How do I make a claim?", expected: "wa-webhook-insurance" },
  { input: "What's my policy number?", expected: "wa-webhook-insurance" },
  
  // Jobs
  { input: "I'm looking for a job", expected: "wa-webhook-jobs" },
  { input: "Show me available work", expected: "wa-webhook-jobs" },
  { input: "I want to apply for employment", expected: "wa-webhook-jobs" },
  
  // Mobility
  { input: "I need a ride", expected: "wa-webhook-mobility" },
  { input: "Book a taxi for me", expected: "wa-webhook-mobility" },
  { input: "Schedule a trip tomorrow", expected: "wa-webhook-mobility" },
  { input: "Nearby drivers", expected: "wa-webhook-mobility" },
  
  // Property
  { input: "I'm looking for a house to rent", expected: "wa-webhook-property" },
  { input: "Show me apartments", expected: "wa-webhook-property" },
  { input: "Property rentals near me", expected: "wa-webhook-property" },
  
  // Profile (formerly wallet - now consolidated)
  { input: "Transfer tokens", expected: "wa-webhook-profile" },
  { input: "Check my balance", expected: "wa-webhook-profile" },
  { input: "I want to redeem my rewards", expected: "wa-webhook-profile" },
  { input: "How do I earn money?", expected: "wa-webhook-profile" },
  { input: "Share easyMO", expected: "wa-webhook-profile" },
  
  // Marketplace
  { input: "I want to buy something", expected: "wa-webhook-marketplace" },
  { input: "Sell my product", expected: "wa-webhook-marketplace" },
  { input: "Show me the marketplace", expected: "wa-webhook-marketplace" },
  
  // AI Agents (fallback for general queries)
  { input: "I need help", expected: "wa-webhook-ai-agents" },
  { input: "Chat with support", expected: "wa-webhook-ai-agents" },
  
  // No match - falls back to core
  { input: "Hello", expected: "wa-webhook-core" },
  { input: "Random message", expected: "wa-webhook-core" },
];

console.log("🧪 Testing wa-webhook-core Routing Logic (Consolidated Config)\n");
console.log("=".repeat(60));

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = routeMessage(test.input);
  const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
  
  if (result === test.expected) {
    passed++;
  } else {
    failed++;
    console.log(`\n${status}`);
    console.log(`  Input: "${test.input}"`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Got: ${result}`);
  }
}

console.log("\n" + "=".repeat(60));
console.log(`\n📊 Results: ${passed}/${tests.length} passed, ${failed} failed`);

if (failed === 0) {
  console.log("\n✅ All routing tests passed!");
  Deno.exit(0);
} else {
  console.log(`\n❌ ${failed} test(s) failed`);
  Deno.exit(1);
}
