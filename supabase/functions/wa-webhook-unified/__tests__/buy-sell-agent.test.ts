/**
 * Unit Tests for Buy & Sell Agent
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { BuySellAgent } from "../agents/buy-sell.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "https://example.supabase.co",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "test-key"
);

// Skip tests that require actual Supabase/API connections
const skipIntegrationTests = !Deno.env.get("GEMINI_API_KEY");

Deno.test("BuySellAgent: should have correct type", { ignore: skipIntegrationTests }, () => {
  const agent = new BuySellAgent({ supabase, correlationId: "test" });
  assertEquals(agent.type, "buy_sell");
});

Deno.test("BuySellAgent: should have combined keywords from marketplace and business_broker", { ignore: skipIntegrationTests }, () => {
  const agent = new BuySellAgent({ supabase, correlationId: "test" });
  assertExists(agent.keywords);
  
  // Marketplace keywords
  assertEquals(agent.keywords.includes("buy"), true);
  assertEquals(agent.keywords.includes("sell"), true);
  assertEquals(agent.keywords.includes("marketplace"), true);
  assertEquals(agent.keywords.includes("shop"), true);
  
  // Business broker keywords
  assertEquals(agent.keywords.includes("business"), true);
  assertEquals(agent.keywords.includes("broker"), true);
  assertEquals(agent.keywords.includes("investment"), true);
});

Deno.test("BuySellAgent: should have comprehensive system prompt", { ignore: skipIntegrationTests }, () => {
  const agent = new BuySellAgent({ supabase, correlationId: "test" });
  assertExists(agent.systemPrompt);
  
  // Should mention both marketplace and business brokerage
  assertEquals(agent.systemPrompt.includes("Buy & Sell"), true);
  assertEquals(agent.systemPrompt.includes("MARKETPLACE"), true);
  assertEquals(agent.systemPrompt.includes("BUSINESS BROKERAGE"), true);
});

Deno.test("BuySellAgent: should have tools for both marketplace and business operations", { ignore: skipIntegrationTests }, () => {
  const agent = new BuySellAgent({ supabase, correlationId: "test" });
  assertExists(agent.tools);
  assertEquals(agent.tools.length >= 3, true);
  
  const toolNames = agent.tools.map(t => t.name);
  assertEquals(toolNames.includes("search_products"), true);
  assertEquals(toolNames.includes("create_listing"), true);
  assertEquals(toolNames.includes("find_businesses"), true);
});

Deno.test("BuySellAgent: create_listing tool should support product, service, and business types", { ignore: skipIntegrationTests }, () => {
  const agent = new BuySellAgent({ supabase, correlationId: "test" });
  const createListingTool = agent.tools.find(t => t.name === "create_listing");
  
  assertExists(createListingTool);
  assertExists(createListingTool.parameters.properties.type);
  
  const typeEnum = createListingTool.parameters.properties.type.enum;
  assertExists(typeEnum);
  assertEquals(typeEnum.includes("product"), true);
  assertEquals(typeEnum.includes("service"), true);
  assertEquals(typeEnum.includes("business"), true);
});
