#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Routing Test Script for wa-webhook-core
 * Tests keyword-based routing without requiring full environment setup
 */

// Mock routing logic (simplified from routing_logic.ts)
const ROUTES = [
  {
    service: "wa-webhook-insurance",
    keywords: ["insurance", "assurance", "cover", "claim", "policy", "premium", "insure"],
    priority: 1,
  },
  {
    service: "wa-webhook-jobs",
    keywords: ["job", "work", "employment", "hire", "career", "apply", "cv", "resume"],
    priority: 1,
  },
  {
    service: "wa-webhook-mobility",
    keywords: ["ride", "trip", "driver", "taxi", "transport", "schedule", "book", "nearby"],
    priority: 1,
  },
  {
    service: "wa-webhook-property",
    keywords: ["property", "rent", "house", "apartment", "rental", "landlord", "tenant"],
    priority: 1,
  },
  {
    service: "wa-webhook-wallet",
    keywords: ["wallet", "token", "transfer", "redeem", "earn", "reward", "balance", "payment", "pay", "deposit", "withdraw", "money", "referral", "share"],
    priority: 1,
  },
  {
    service: "wa-webhook-marketplace",
    keywords: ["marketplace", "shop", "buy", "sell", "store", "product"],
    priority: 1,
  },
  {
    service: "wa-webhook-ai-agents",
    keywords: ["agent", "chat", "help", "support", "ask"],
    priority: 3,
  },
];

function routeMessage(messageText: string): string {
  const text = messageText.toLowerCase();
  
  const matches = ROUTES.map((route) => ({
    service: route.service,
    score: route.keywords.filter((kw) => text.includes(kw)).length,
    priority: route.priority,
  })).filter((m) => m.score > 0);

  if (matches.length > 0) {
    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.priority - b.priority;
    });
    return matches[0].service;
  }

  return "wa-webhook-ai-agents"; // fallback
}

// Test cases
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
  
  // Wallet
  { input: "Transfer tokens", expected: "wa-webhook-wallet" },
  { input: "Check my balance", expected: "wa-webhook-wallet" },
  { input: "I want to redeem my rewards", expected: "wa-webhook-wallet" },
  { input: "How do I earn money?", expected: "wa-webhook-wallet" },
  { input: "Share easyMO", expected: "wa-webhook-wallet" },
  
  // Marketplace
  { input: "I want to buy something", expected: "wa-webhook-marketplace" },
  { input: "Sell my product", expected: "wa-webhook-marketplace" },
  { input: "Show me the marketplace", expected: "wa-webhook-marketplace" },
  
  // Fallback
  { input: "Hello", expected: "wa-webhook-ai-agents" },
  { input: "Random message", expected: "wa-webhook-ai-agents" },
  { input: "What can you do?", expected: "wa-webhook-ai-agents" },
];

console.log("🧪 Testing wa-webhook-core Routing Logic\n");
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
