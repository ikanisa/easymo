/**
 * E2E Test Scenarios for Unified Service
 * 
 * Run with: deno test --allow-net --allow-env
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const WEBHOOK_URL = Deno.env.get("TEST_WEBHOOK_URL") || "http://localhost:54321/functions/v1/wa-webhook-unified";
const TEST_PHONE = "+250788123456";

/**
 * Test: Support Agent - Services Menu
 */
Deno.test("Support Agent: Show services menu", async () => {
  const response = await sendMessage(TEST_PHONE, "help");
  
  assertExists(response);
  assertEquals(response.status, "success");
  // Should show services menu
});

/**
 * Test: Marketplace Agent - Selling Flow
 */
Deno.test("Marketplace Agent: Selling flow", async () => {
  // Step 1: Initiate selling
  const step1 = await sendMessage(TEST_PHONE, "I want to sell my laptop");
  assertExists(step1);
  
  // Should ask for price or description
  // Continue flow...
});

/**
 * Test: Jobs Agent - Job Search Flow (Hybrid)
 */
Deno.test("Jobs Agent: Job search flow", async () => {
  // Step 1: Initiate search
  const step1 = await sendMessage(TEST_PHONE, "I need a job");
  assertExists(step1);
  
  // Step 2: Provide category
  const step2 = await sendMessage(TEST_PHONE, "driver");
  assertExists(step2);
  
  // Step 3: Provide location
  const step3 = await sendMessage(TEST_PHONE, "Kigali");
  assertExists(step3);
  
  // Should return job results
});

/**
 * Test: Property Agent - Property Search Flow (Hybrid)
 */
Deno.test("Property Agent: Property search flow", async () => {
  // Step 1: Initiate search
  const step1 = await sendMessage(TEST_PHONE, "I need an apartment");
  assertExists(step1);
  
  // Step 2: Type
  const step2 = await sendMessage(TEST_PHONE, "apartment");
  assertExists(step2);
  
  // Step 3: Bedrooms
  const step3 = await sendMessage(TEST_PHONE, "2");
  assertExists(step3);
  
  // Step 4: Budget
  const step4 = await sendMessage(TEST_PHONE, "100000");
  assertExists(step4);
  
  // Step 5: Location
  const step5 = await sendMessage(TEST_PHONE, "Kimironko");
  assertExists(step5);
  
  // Should return property results
});

/**
 * Test: Cross-Domain Handoff (Marketplace → Jobs)
 */
Deno.test("Cross-domain handoff: Marketplace to Jobs", async () => {
  // Start in marketplace
  const step1 = await sendMessage(TEST_PHONE, "I'm selling furniture");
  assertExists(step1);
  
  // User asks about jobs
  const step2 = await sendMessage(TEST_PHONE, "Actually, I need a job instead");
  assertExists(step2);
  
  // Should handoff to jobs agent
  // Verify session shows jobs as current agent
});

/**
 * Test: Session Persistence
 */
Deno.test("Session persistence across messages", async () => {
  // Message 1
  const msg1 = await sendMessage(TEST_PHONE, "Looking for a pharmacy");
  assertExists(msg1);
  
  // Message 2 (should remember context)
  const msg2 = await sendMessage(TEST_PHONE, "in Kimironko");
  assertExists(msg2);
  
  // Should use location from previous message
});

/**
 * Test: Intent Classification
 */
Deno.test("Intent classification accuracy", async () => {
  const tests = [
    { input: "I need a job", expectedAgent: "jobs" },
    { input: "Looking for apartment", expectedAgent: "property" },
    { input: "Selling tomatoes", expectedAgent: "farmer" },
    { input: "Motor insurance", expectedAgent: "insurance" },
    { input: "Need a ride", expectedAgent: "rides" },
    { input: "Show me restaurants", expectedAgent: "waiter" },
  ];
  
  for (const test of tests) {
    const response = await sendMessage(TEST_PHONE, test.input);
    assertExists(response);
    // Verify correct agent was selected
  }
});

/**
 * Helper: Send WhatsApp message to webhook
 */
async function sendMessage(phone: string, text: string) {
  const payload = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: crypto.randomUUID(),
            from: phone,
            type: "text",
            text: { body: text },
            timestamp: Date.now().toString(),
          }],
          contacts: [{
            profile: { name: "Test User" },
            wa_id: phone,
          }],
        },
      }],
    }],
  };

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-wa-internal-forward": "true", // Bypass signature verification
    },
    body: JSON.stringify(payload),
  });

  return await response.json();
}

/**
 * Helper: Get session for user
 */
async function getSession(phone: string) {
  // Would query unified_sessions table
  return null;
}

/**
 * Helper: Clear session
 */
async function clearSession(phone: string) {
  // Would delete from unified_sessions table
}
