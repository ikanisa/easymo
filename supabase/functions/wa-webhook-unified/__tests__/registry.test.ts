/**
 * Unit Tests for Agent Registry
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { AgentRegistry } from "../agents/registry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "https://example.supabase.co",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "test-key"
);

// Skip tests that require actual Supabase/API connections
const skipIntegrationTests = !Deno.env.get("GEMINI_API_KEY");

Deno.test("AgentRegistry: should return BuySellAgent for buy_sell type", { ignore: skipIntegrationTests }, () => {
  const registry = new AgentRegistry(supabase);
  const agent = registry.getAgent("buy_sell", "test-correlation");
  
  assertExists(agent);
  assertEquals(agent.type, "buy_sell");
});

Deno.test("AgentRegistry: should alias business_broker to buy_sell", { ignore: skipIntegrationTests }, () => {
  const registry = new AgentRegistry(supabase);
  const agent = registry.getAgent("business_broker", "test-correlation");
  
  assertExists(agent);
  assertEquals(agent.type, "buy_sell");
});

Deno.test("AgentRegistry: should alias marketplace to buy_sell", { ignore: skipIntegrationTests }, () => {
  const registry = new AgentRegistry(supabase);
  const agent = registry.getAgent("marketplace", "test-correlation");
  
  assertExists(agent);
  assertEquals(agent.type, "buy_sell");
});

Deno.test("AgentRegistry: should alias business_broker_agent to buy_sell", { ignore: skipIntegrationTests }, () => {
  const registry = new AgentRegistry(supabase);
  const agent = registry.getAgent("business_broker_agent" as any, "test-correlation");
  
  assertExists(agent);
  assertEquals(agent.type, "buy_sell");
});

Deno.test("AgentRegistry: should alias marketplace_agent to buy_sell", { ignore: skipIntegrationTests }, () => {
  const registry = new AgentRegistry(supabase);
  const agent = registry.getAgent("marketplace_agent" as any, "test-correlation");
  
  assertExists(agent);
  assertEquals(agent.type, "buy_sell");
});

Deno.test("AgentRegistry: should return correct agent for waiter type", { ignore: skipIntegrationTests }, () => {
  const registry = new AgentRegistry(supabase);
  const agent = registry.getAgent("waiter", "test-correlation");
  
  assertExists(agent);
  assertEquals(agent.type, "waiter");
});

Deno.test("AgentRegistry: should return correct agent for farmer type", { ignore: skipIntegrationTests }, () => {
  const registry = new AgentRegistry(supabase);
  const agent = registry.getAgent("farmer", "test-correlation");
  
  assertExists(agent);
  assertEquals(agent.type, "farmer");
});

Deno.test("AgentRegistry: should return correct agent for support type", { ignore: skipIntegrationTests }, () => {
  const registry = new AgentRegistry(supabase);
  const agent = registry.getAgent("support", "test-correlation");
  
  assertExists(agent);
  assertEquals(agent.type, "support");
});

Deno.test("AgentRegistry: should fallback to support for unknown types", { ignore: skipIntegrationTests }, () => {
  const registry = new AgentRegistry(supabase);
  const agent = registry.getAgent("unknown_agent_type" as any, "test-correlation");
  
  assertExists(agent);
  assertEquals(agent.type, "support");
});

Deno.test("AgentRegistry: listAgents should include buy_sell with consolidates info", { ignore: skipIntegrationTests }, () => {
  const registry = new AgentRegistry(supabase);
  const agents = registry.listAgents();
  
  assertExists(agents);
  
  const buySellAgent = agents.find(a => a.type === "buy_sell");
  assertExists(buySellAgent);
  assertEquals(buySellAgent.name, "Buy & Sell Agent");
  assertExists(buySellAgent.consolidates);
  assertEquals(buySellAgent.consolidates?.includes("business_broker"), true);
  assertEquals(buySellAgent.consolidates?.includes("marketplace"), true);
});

Deno.test("AgentRegistry: clearCache should reset agents map", { ignore: skipIntegrationTests }, () => {
  const registry = new AgentRegistry(supabase);
  
  // Get an agent to populate cache
  registry.getAgent("support", "test-correlation");
  
  // Clear cache
  registry.clearCache();
  
  // Getting agent again should work (would fail if internal state was corrupted)
  const agent = registry.getAgent("support", "test-correlation-2");
  assertExists(agent);
});
