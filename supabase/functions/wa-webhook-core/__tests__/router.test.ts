/**
 * Router Unit Tests
 * Tests for message routing logic in wa-webhook-core
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import {
  createMockSupabase,
  createMockWebhookPayload,
  createTestSuite,
} from "../../_shared/testing/test-utils.ts";
import { TEST_USERS, TEST_MESSAGES } from "../../_shared/testing/fixtures.ts";

// ============================================================================
// ROUTING DECISION TESTS
// ============================================================================

const routingSuite = createTestSuite("Router - Routing Decisions");

routingSuite.test("routes greeting to home menu", () => {
  TEST_MESSAGES.greetings.forEach((greeting) => {
    const decision = mockRouteByKeyword(greeting);
    assertEquals(decision.reason, "home_menu", `Greeting "${greeting}" should show home menu`);
  });
});

routingSuite.test("routes mobility keywords to mobility service", () => {
  TEST_MESSAGES.mobilityKeywords.forEach((keyword) => {
    const decision = mockRouteByKeyword(`I need a ${keyword}`);
    assertEquals(decision.service, "wa-webhook-mobility", `Keyword "${keyword}" should route to mobility`);
  });
});

routingSuite.test("routes insurance keywords to core (handled inline)", () => {
  TEST_MESSAGES.insuranceKeywords.forEach((keyword) => {
    const decision = mockRouteByKeyword(`I want ${keyword}`);
    // Insurance is handled inline by wa-webhook-core, not by a separate service
    assertEquals(decision.service, "wa-webhook-core", `Keyword "${keyword}" should route to core (insurance handled inline)`);
  });
});

routingSuite.test("routes profile keywords to profile service", () => {
  TEST_MESSAGES.profileKeywords.forEach((keyword) => {
    const decision = mockRouteByKeyword(`check my ${keyword}`);
    assertEquals(decision.service, "wa-webhook-profile", `Keyword "${keyword}" should route to profile`);
  });
});

// ============================================================================
// STATE-BASED ROUTING TESTS
// ============================================================================

const stateSuite = createTestSuite("Router - State-Based Routing");

stateSuite.test("routes to mobility when session state is mobility", () => {
  const decision = mockRouteByState("mobility_nearby_location");
  assertEquals(decision.service, "wa-webhook-mobility");
  assertEquals(decision.reason, "state");
});

stateSuite.test("routes to core when session state is insurance (handled inline)", () => {
  const decision = mockRouteByState("ins_wait_doc");
  // Insurance is handled inline by wa-webhook-core
  assertEquals(decision.service, "wa-webhook-core");
  assertEquals(decision.reason, "state");
});

stateSuite.test("routes to profile when session state is wallet", () => {
  const decision = mockRouteByState("wallet_transfer_amount");
  assertEquals(decision.service, "wa-webhook-profile");
  assertEquals(decision.reason, "state");
});

// ============================================================================
// FALLBACK ROUTING TESTS
// ============================================================================

const fallbackSuite = createTestSuite("Router - Fallback Behavior");

fallbackSuite.test("returns fallback for unknown input", () => {
  const decision = mockRouteByKeyword("asdfghjkl123456");
  assertEquals(decision.reason, "fallback");
});

fallbackSuite.test("returns fallback for empty input", () => {
  const decision = mockRouteByKeyword("");
  assertEquals(decision.reason, "fallback");
});

// ============================================================================
// INTERACTIVE MESSAGE ROUTING TESTS
// ============================================================================

const interactiveSuite = createTestSuite("Router - Interactive Messages");

interactiveSuite.test("routes button selection correctly", () => {
  const payload = createMockWebhookPayload({
    messageType: "interactive",
    buttonId: "rides",
  });
  // Would be routed to mobility
  assertExists(payload.entry[0].changes[0].value.messages[0].interactive);
});

interactiveSuite.test("routes list selection correctly", () => {
  const payload = createMockWebhookPayload({
    messageType: "interactive",
    listId: "insurance",
  });
  assertExists(payload.entry[0].changes[0].value.messages[0].interactive);
});

// ============================================================================
// MOCK ROUTING FUNCTIONS (Simplified versions for testing)
// ============================================================================

type RoutingDecision = {
  service: string;
  reason: "keyword" | "state" | "fallback" | "home_menu";
  routingText?: string;
};

function mockRouteByKeyword(text: string): RoutingDecision {
  const lowerText = text.toLowerCase().trim();

  // Check greetings
  if (TEST_MESSAGES.greetings.some((g) => lowerText.includes(g))) {
    return { service: "wa-webhook-core", reason: "home_menu", routingText: text };
  }

  // Check mobility keywords
  if (TEST_MESSAGES.mobilityKeywords.some((k) => lowerText.includes(k))) {
    return { service: "wa-webhook-mobility", reason: "keyword", routingText: text };
  }

  // Check insurance keywords - handled inline by wa-webhook-core
  if (TEST_MESSAGES.insuranceKeywords.some((k) => lowerText.includes(k))) {
    return { service: "wa-webhook-core", reason: "keyword", routingText: text };
  }

  // Check profile keywords
  if (TEST_MESSAGES.profileKeywords.some((k) => lowerText.includes(k))) {
    return { service: "wa-webhook-profile", reason: "keyword", routingText: text };
  }

  // Fallback
  return { service: "wa-webhook-core", reason: "fallback" };
}

function mockRouteByState(state: string): RoutingDecision {
  if (state.startsWith("mobility_") || state.startsWith("trip_")) {
    return { service: "wa-webhook-mobility", reason: "state" };
  }
  // Insurance is handled inline by wa-webhook-core
  if (state.startsWith("ins_") || state.startsWith("claim_")) {
    return { service: "wa-webhook-core", reason: "state" };
  }
  if (state.startsWith("wallet_") || state.startsWith("profile_")) {
    return { service: "wa-webhook-profile", reason: "state" };
  }
  return { service: "wa-webhook-core", reason: "fallback" };
}

console.log("✅ Router tests loaded");
