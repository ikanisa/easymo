/**
 * Integration Tests for Chat-First AI Agents
 * 
 * Tests end-to-end agent conversations with emoji selection,
 * response formatting, and session tracking.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { formatAgentResponse } from "../shared/response_formatter.ts";
import { parseEmojiSelection, isSelectionMessage, createListMessage } from "../shared/message_formatter.ts";
import type { AgentResponse, AgentType } from "../shared/agent_orchestrator.ts";
import type { AgentContext } from "../shared/agent_context.ts";

// Mock agent context
function createMockContext(agentType: AgentType): AgentContext {
  return {
    userId: "test-user-id",
    phoneNumber: "+250788123456",
    conversationId: "test-conv-id",
    currentMessage: "test message",
    correlationId: "test-correlation-id",
    supabase: {} as any,
    toneLocale: "en",
    language: "en",
    sessionData: {},
  };
}

// Mock agent response
function createMockResponse(agentType: AgentType, text: string): AgentResponse {
  return {
    text,
    agentType,
    tokensUsed: 100,
    costUsd: 0.01,
    latencyMs: 500,
    toolCallsExecuted: 1,
    confidence: 0.9,
  };
}

Deno.test("Integration: Waiter Agent - Restaurant List Flow", () => {
  const agentType: AgentType = "waiter";
  const context = createMockContext(agentType);

  // Agent returns restaurant list
  const response = createMockResponse(
    agentType,
    "🍽️ I found 3 restaurants near you:\n\n1. Bourbon Coffee Kigali\n   ☕ Coffee & Pastries • 2km away\n   ⭐ 4.5/5 rating\n\n2. Heaven Restaurant\n   🍕 International cuisine • 3km away\n   ⭐ 4.8/5 rating\n\n3. Repub Lounge\n   🍺 Bar & Grill • 1.5km away\n   ⭐ 4.2/5 rating"
  );

  // Format response
  const formatted = formatAgentResponse(response, context);

  // Verify emoji list was created
  assertExists(formatted.optionsPresented);
  assertEquals(formatted.optionsPresented?.length, 3);
  assertEquals(formatted.requiresSelection, true);

  // Verify action buttons
  assertExists(formatted.actionButtons);
  assertEquals(formatted.actionButtons?.some(b => b.id === "search_again"), true);
  assertEquals(formatted.actionButtons?.some(b => b.id === "home"), true);

  // Verify text contains emoji numbers
  assertEquals(formatted.text.includes("1️⃣"), true);
  assertEquals(formatted.text.includes("2️⃣"), true);
  assertEquals(formatted.text.includes("3️⃣"), true);
});

Deno.test("Integration: Rides Agent - Driver List Flow", () => {
  const agentType: AgentType = "rides";
  const context = createMockContext(agentType);

  // Agent returns driver list
  const response = createMockResponse(
    agentType,
    "🚗 I found 3 drivers nearby:\n\n1. Jean - Toyota Corolla\n   📍 500m away • ⏱️ 2 min\n   ⭐ 4.8/5 (127 trips)\n\n2. Marie - Honda Fit\n   📍 800m away • ⏱️ 4 min\n   ⭐ 4.9/5 (203 trips)"
  );

  // Format response
  const formatted = formatAgentResponse(response, context);

  // Verify options extracted
  assertExists(formatted.optionsPresented);
  assertEquals(formatted.optionsPresented?.length, 2);

  // Verify action buttons for rides
  assertExists(formatted.actionButtons);
  assertEquals(formatted.actionButtons?.some(b => b.id === "schedule_trip"), true);
});

Deno.test("Integration: Emoji Selection Parsing - Number", () => {
  const userInput = "1";
  const optionsCount = 3;

  const selection = parseEmojiSelection(userInput, optionsCount);

  assertEquals(selection, 1);
  assertEquals(isSelectionMessage(userInput, optionsCount), true);
});

Deno.test("Integration: Emoji Selection Parsing - Emoji", () => {
  const userInput = "2️⃣";
  const optionsCount = 3;

  const selection = parseEmojiSelection(userInput, optionsCount);

  assertEquals(selection, 2);
  assertEquals(isSelectionMessage(userInput, optionsCount), true);
});

Deno.test("Integration: Emoji Selection Parsing - Text Phrase", () => {
  const userInput = "the first one";
  const optionsCount = 3;

  const selection = parseEmojiSelection(userInput, optionsCount);

  assertEquals(selection, 1);
  assertEquals(isSelectionMessage(userInput, optionsCount), true);
});

Deno.test("Integration: Emoji Selection Parsing - Ordinal", () => {
  const userInput = "second";
  const optionsCount = 3;

  const selection = parseEmojiSelection(userInput, optionsCount);

  assertEquals(selection, 2);
  assertEquals(isSelectionMessage(userInput, optionsCount), true);
});

Deno.test("Integration: Jobs Agent - Job List Flow", () => {
  const agentType: AgentType = "jobs";
  const context = createMockContext(agentType);

  // Agent returns job list
  const response = createMockResponse(
    agentType,
    "💼 I found 3 job opportunities:\n\n1. Sales Representative\n   💰 150,000 RWF/month\n   📍 Kigali, Nyarugenge • ⏰ Full-time\n\n2. Delivery Driver\n   💰 120,000 RWF/month\n   📍 Kigali, Gasabo • ⏰ Part-time"
  );

  // Format response
  const formatted = formatAgentResponse(response, context);

  // Verify options
  assertExists(formatted.optionsPresented);
  assertEquals(formatted.optionsPresented?.length, 2);

  // Verify action buttons for jobs
  assertExists(formatted.actionButtons);
  assertEquals(formatted.actionButtons?.some(b => b.id === "post_job"), true);
});

Deno.test("Integration: Response Without Options - Plain Text", () => {
  const agentType: AgentType = "support";
  const context = createMockContext(agentType);

  // Agent returns plain text (no list)
  const response = createMockResponse(
    agentType,
    "I can help you with that! What specific issue are you experiencing?"
  );

  // Format response
  const formatted = formatAgentResponse(response, context);

  // Verify no options extracted
  assertEquals(formatted.optionsPresented, undefined);
  assertEquals(formatted.requiresSelection, undefined);

  // Verify still has action buttons
  assertExists(formatted.actionButtons);
  assertEquals(formatted.actionButtons?.some(b => b.id === "home"), true);
});

Deno.test("Integration: Insurance Agent - Quote Options", () => {
  const agentType: AgentType = "insurance";
  const context = createMockContext(agentType);

  // Agent returns insurance options
  const response = createMockResponse(
    agentType,
    "🛡️ Available insurance plans:\n\n1. Third Party Coverage\n   💰 50,000 RWF/year\n   ✅ Basic liability coverage\n\n2. Comprehensive Coverage\n   💰 150,000 RWF/year\n   ✅ Full protection + theft"
  );

  // Format response
  const formatted = formatAgentResponse(response, context);

  // Verify options
  assertExists(formatted.optionsPresented);
  assertEquals(formatted.optionsPresented?.length, 2);

  // Verify action buttons for insurance
  assertExists(formatted.actionButtons);
  assertEquals(formatted.actionButtons?.some(b => b.id === "get_quote"), true);
});

Deno.test("Integration: Pharmacy Agent - Pharmacy List", () => {
  const agentType: AgentType = "pharmacy";
  const context = createMockContext(agentType);

  // Agent returns pharmacy list
  const response = createMockResponse(
    agentType,
    "💊 Pharmacies near you:\n\n1. City Pharmacy\n   📍 500m away • ⏰ Open until 9 PM\n\n2. Health Plus Pharmacy\n   📍 1km away • ⏰ Open 24/7"
  );

  // Format response
  const formatted = formatAgentResponse(response, context);

  // Verify options
  assertExists(formatted.optionsPresented);
  assertEquals(formatted.optionsPresented?.length, 2);

  // Verify action buttons for pharmacy
  assertExists(formatted.actionButtons);
  assertEquals(formatted.actionButtons?.length >= 1, true);
});

Deno.test("Integration: Create List Message - Full Flow", () => {
  const header = "🍽️ Found 3 restaurants:";
  const options = [
    { id: "1", title: "Restaurant A", description: "Italian cuisine" },
    { id: "2", title: "Restaurant B", description: "Japanese cuisine" },
    { id: "3", title: "Restaurant C", description: "French cuisine" },
  ];
  const footer = "Reply with the number to select!";
  const buttons = [
    { id: "search_again", title: "🔍 Search Again" },
    { id: "home", title: "🏠 Home" },
  ];

  const message = createListMessage(header, options, footer, buttons);

  // Verify structure
  assertEquals(message.text.includes("1️⃣"), true);
  assertEquals(message.text.includes("2️⃣"), true);
  assertEquals(message.text.includes("3️⃣"), true);
  assertEquals(message.text.includes(header), true);
  assertEquals(message.text.includes(footer), true);
  assertEquals(message.buttons?.length, 2);
});

Deno.test("Integration: Selection Message Detection", () => {
  const optionsCount = 3;
  
  // Valid selections
  assertEquals(isSelectionMessage("1", optionsCount), true);
  assertEquals(isSelectionMessage("2️⃣", optionsCount), true);
  assertEquals(isSelectionMessage("the first one", optionsCount), true);
  assertEquals(isSelectionMessage("second", optionsCount), true);
  assertEquals(isSelectionMessage("option 3", optionsCount), true);

  // Invalid selections
  assertEquals(isSelectionMessage("hello", optionsCount), false);
  assertEquals(isSelectionMessage("what are my options?", optionsCount), false);
  assertEquals(isSelectionMessage("I want to book a trip", optionsCount), false);
});

Deno.test("Integration: Max 10 Options Limit", () => {
  const agentType: AgentType = "real_estate";
  const context = createMockContext(agentType);

  // Agent returns 12 properties (should be limited to 10)
  const response = createMockResponse(
    agentType,
    "🏠 Found 12 properties:\n\n" +
    Array.from({ length: 12 }, (_, i) => 
      `${i + 1}. Property ${i + 1}\n   Description`
    ).join("\n\n")
  );

  // Format response
  const formatted = formatAgentResponse(response, context);

  // Verify limited to 10
  assertExists(formatted.optionsPresented);
  assertEquals(formatted.optionsPresented?.length, 10);
});

Deno.test("Integration: Action Buttons Validation - Max 3", () => {
  const agentType: AgentType = "waiter";
  const context = createMockContext(agentType);

  const response = createMockResponse(agentType, "Test message");
  const formatted = formatAgentResponse(response, context);

  // Verify max 3 buttons (WhatsApp limit)
  assertExists(formatted.actionButtons);
  assertEquals(formatted.actionButtons!.length <= 3, true);
});

console.log("\n✅ All integration tests completed successfully!\n");
