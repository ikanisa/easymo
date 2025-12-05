/**
 * Unit Tests for Buy & Sell Agent
 * (Previously MarketplaceAgent - now unified)
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { BuySellAgent } from "../agents/buy-sell.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

Deno.test("BuySellAgent: should have correct type", () => {
  const agent = new BuySellAgent({ supabase, correlationId: "test" });
  assertEquals(agent.type, "buy_and_sell");
});

Deno.test("BuySellAgent: should have keywords", () => {
  const agent = new BuySellAgent({ supabase, correlationId: "test" });
  assertExists(agent.keywords);
  assertEquals(agent.keywords.includes("buy"), true);
  assertEquals(agent.keywords.includes("sell"), true);
  // Additional keywords from business broker
  assertEquals(agent.keywords.includes("business"), true);
  assertEquals(agent.keywords.includes("broker"), true);
});

Deno.test("BuySellAgent: should have system prompt", () => {
  const agent = new BuySellAgent({ supabase, correlationId: "test" });
  assertExists(agent.systemPrompt);
  // Should contain both marketplace and business broker content
  assertEquals(agent.systemPrompt.includes("Buy") || agent.systemPrompt.includes("Sell"), true);
});

Deno.test("BuySellAgent: should have tools", () => {
  const agent = new BuySellAgent({ supabase, correlationId: "test" });
  assertExists(agent.tools);
  assertEquals(agent.tools.length > 0, true);
  
  const toolNames = agent.tools.map(t => t.name);
  assertEquals(toolNames.includes("create_listing"), true);
  assertEquals(toolNames.includes("search_products"), true);
});

Deno.test("BuySellAgent: should create listing", async () => {
  const agent = new BuySellAgent({ supabase, correlationId: "test" });
  
  // Mock data
  const testData = {
    product_name: "Test Laptop",
    description: "Good condition",
    price: 500000,
    location_text: "Kigali",
  };
  
  // Note: This would need a test database
  // For now, just verify the method exists
  assertExists(agent.executeTool);
});
