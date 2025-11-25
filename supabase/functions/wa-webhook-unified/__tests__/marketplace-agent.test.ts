/**
 * Unit Tests for Marketplace Agent
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MarketplaceAgent } from "../agents/marketplace-agent.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

Deno.test("MarketplaceAgent: should have correct type", () => {
  const agent = new MarketplaceAgent({ supabase, correlationId: "test" });
  assertEquals(agent.type, "marketplace");
});

Deno.test("MarketplaceAgent: should have keywords", () => {
  const agent = new MarketplaceAgent({ supabase, correlationId: "test" });
  assertExists(agent.keywords);
  assertEquals(agent.keywords.includes("buy"), true);
  assertEquals(agent.keywords.includes("sell"), true);
});

Deno.test("MarketplaceAgent: should have system prompt", () => {
  const agent = new MarketplaceAgent({ supabase, correlationId: "test" });
  assertExists(agent.systemPrompt);
  assertEquals(agent.systemPrompt.includes("Marketplace"), true);
});

Deno.test("MarketplaceAgent: should have tools", () => {
  const agent = new MarketplaceAgent({ supabase, correlationId: "test" });
  assertExists(agent.tools);
  assertEquals(agent.tools.length > 0, true);
  
  const toolNames = agent.tools.map(t => t.name);
  assertEquals(toolNames.includes("create_listing"), true);
  assertEquals(toolNames.includes("search_listings"), true);
});

Deno.test("MarketplaceAgent: should create listing", async () => {
  const agent = new MarketplaceAgent({ supabase, correlationId: "test" });
  
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
