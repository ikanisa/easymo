/**
 * Tests for feature flags utilities
 * Run with: deno test --allow-env supabase/functions/_shared/feature-flags.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isFeatureEnabled, getAllFeatureFlags } from "./feature-flags.ts";

Deno.test("isFeatureEnabled - returns default value when env not set", () => {
  // agent.chat defaults to true
  const enabled = isFeatureEnabled("agent.chat");
  assertEquals(enabled, true);

  // wallet.service defaults to false
  const disabled = isFeatureEnabled("wallet.service");
  assertEquals(disabled, false);
});

Deno.test("isFeatureEnabled - respects environment variable", () => {
  Deno.env.set("FEATURE_WALLET_SERVICE", "true");
  const enabled = isFeatureEnabled("wallet.service");
  assertEquals(enabled, true);
  Deno.env.delete("FEATURE_WALLET_SERVICE");
});

Deno.test("isFeatureEnabled - handles various true values", () => {
  const trueValues = ["1", "true", "TRUE", "yes", "YES", "on", "ON"];
  
  for (const value of trueValues) {
    Deno.env.set("FEATURE_MARKETPLACE_RANKING", value);
    const enabled = isFeatureEnabled("marketplace.ranking");
    assertEquals(enabled, true, `Failed for value: ${value}`);
    Deno.env.delete("FEATURE_MARKETPLACE_RANKING");
  }
});

Deno.test("isFeatureEnabled - handles false values", () => {
  const falseValues = ["0", "false", "FALSE", "no", "NO", "off", "OFF"];
  
  for (const value of falseValues) {
    Deno.env.set("FEATURE_AGENT_CHAT", value);
    const enabled = isFeatureEnabled("agent.chat");
    assertEquals(enabled, false, `Failed for value: ${value}`);
    Deno.env.delete("FEATURE_AGENT_CHAT");
  }
});

Deno.test("getAllFeatureFlags - returns all flags", () => {
  const flags = getAllFeatureFlags();
  assertEquals(typeof flags, "object");
  assertEquals("agent.chat" in flags, true);
  assertEquals("wallet.service" in flags, true);
});
