/**
 * Unit Tests for Intent Classifier
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { IntentClassifier } from "../core/intent-classifier.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "https://example.supabase.co",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "test-key"
);

Deno.test("IntentClassifier: should classify marketplace keywords as buy_sell", async () => {
  const classifier = new IntentClassifier(supabase);
  const result = await classifier.classify("I want to buy a laptop", []);
  
  assertEquals(result.agentType, "buy_sell");
  assertEquals(result.confidence > 0, true);
});

Deno.test("IntentClassifier: should classify business keywords as buy_sell", async () => {
  const classifier = new IntentClassifier(supabase);
  const result = await classifier.classify("I'm looking for business investment opportunities", []);
  
  assertEquals(result.agentType, "buy_sell");
  assertEquals(result.confidence > 0, true);
});

Deno.test("IntentClassifier: should classify selling keywords as buy_sell", async () => {
  const classifier = new IntentClassifier(supabase);
  const result = await classifier.classify("I want to sell my products on marketplace", []);
  
  assertEquals(result.agentType, "buy_sell");
  assertEquals(result.confidence > 0, true);
});

Deno.test("IntentClassifier: should classify farming keywords as farmer", async () => {
  const classifier = new IntentClassifier(supabase);
  const result = await classifier.classify("What's the price of maize today?", []);
  
  assertEquals(result.agentType, "farmer");
  assertEquals(result.confidence > 0, true);
});

Deno.test("IntentClassifier: should classify food keywords as waiter", async () => {
  const classifier = new IntentClassifier(supabase);
  const result = await classifier.classify("I want to order food from a restaurant", []);
  
  assertEquals(result.agentType, "waiter");
  assertEquals(result.confidence > 0, true);
});

Deno.test("IntentClassifier: should classify ride keywords as rides", async () => {
  const classifier = new IntentClassifier(supabase);
  const result = await classifier.classify("I need a taxi to take me to the airport", []);
  
  assertEquals(result.agentType, "rides");
  assertEquals(result.confidence > 0, true);
});

Deno.test("IntentClassifier: should classify job keywords as jobs", async () => {
  const classifier = new IntentClassifier(supabase);
  const result = await classifier.classify("I'm looking for a job as a developer", []);
  
  assertEquals(result.agentType, "jobs");
  assertEquals(result.confidence > 0, true);
});

Deno.test("IntentClassifier: should classify property keywords as real_estate", async () => {
  const classifier = new IntentClassifier(supabase);
  const result = await classifier.classify("I need to rent an apartment", []);
  
  assertEquals(result.agentType, "real_estate");
  assertEquals(result.confidence > 0, true);
});

Deno.test("IntentClassifier: should classify insurance keywords as insurance", async () => {
  const classifier = new IntentClassifier(supabase);
  const result = await classifier.classify("I need car insurance policy", []);
  
  assertEquals(result.agentType, "insurance");
  assertEquals(result.confidence > 0, true);
});

Deno.test("IntentClassifier: should default to support for unclear messages", async () => {
  const classifier = new IntentClassifier(supabase);
  const result = await classifier.classify("hello there", []);
  
  assertEquals(result.agentType, "support");
});

Deno.test("IntentClassifier: should boost rides priority for time-sensitive requests", async () => {
  const classifier = new IntentClassifier(supabase);
  
  // With ride-related keyword, should have high confidence due to boost
  const result = await classifier.classify("I need a ride now", []);
  
  assertEquals(result.agentType, "rides");
  assertEquals(result.confidence > 0.5, true);
});

Deno.test("IntentClassifier: should boost insurance priority", async () => {
  const classifier = new IntentClassifier(supabase);
  
  const result = await classifier.classify("I need insurance for my car", []);
  
  assertEquals(result.agentType, "insurance");
  assertEquals(result.confidence > 0.5, true);
});

Deno.test("IntentClassifier: result should include matched keywords", async () => {
  const classifier = new IntentClassifier(supabase);
  const result = await classifier.classify("I want to buy and sell products", []);
  
  assertExists(result.keywords);
  assertEquals(result.keywords?.includes("buy"), true);
  assertEquals(result.keywords?.includes("sell"), true);
});
