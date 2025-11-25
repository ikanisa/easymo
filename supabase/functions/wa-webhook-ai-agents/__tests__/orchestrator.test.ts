/**
 * Agent Orchestrator Tests
 * Tests routing, intent parsing, session management
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { AgentOrchestrator } from "../../_shared/agent-orchestrator.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Test setup
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const orchestrator = new AgentOrchestrator(supabase);

// Helper to create test message
function createTestMessage(body: string, from = `test-${Date.now()}`): any {
  return {
    from,
    body,
    type: "text",
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID(),
  };
}

// Helper to cleanup test data
async function cleanup(phoneNumber: string) {
  await supabase.from("agent_chat_sessions").delete().eq("user_phone", phoneNumber);
  await supabase.from("whatsapp_users").delete().eq("phone_number", phoneNumber);
  await supabase.from("whatsapp_conversations").delete().eq("context", "test");
}

Deno.test("Agent Routing: Jobs Agent", async () => {
  const testPhone = `test-jobs-${Date.now()}`;
  const message = createTestMessage("I need a job in software", testPhone);
  
  try {
    await orchestrator.processMessage(message);
    
    // Verify session was created with jobs agent
    const { data: session } = await supabase
      .from("agent_chat_sessions")
      .select("agent_type")
      .eq("user_phone", testPhone)
      .single();
    
    assertEquals(session?.agent_type, "jobs");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Agent Routing: Real Estate Agent", async () => {
  const testPhone = `test-realestate-${Date.now()}`;
  const message = createTestMessage("looking for 3 bedroom house to rent", testPhone);
  
  try {
    await orchestrator.processMessage(message);
    
    const { data: session } = await supabase
      .from("agent_chat_sessions")
      .select("agent_type")
      .eq("user_phone", testPhone)
      .single();
    
    assertEquals(session?.agent_type, "real_estate");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Agent Routing: Rides Agent", async () => {
  const testPhone = `test-rides-${Date.now()}`;
  const message = createTestMessage("need a ride from airport to downtown", testPhone);
  
  try {
    await orchestrator.processMessage(message);
    
    const { data: session } = await supabase
      .from("agent_chat_sessions")
      .select("agent_type")
      .eq("user_phone", testPhone)
      .single();
    
    assertEquals(session?.agent_type, "rides");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Agent Routing: Insurance Agent", async () => {
  const testPhone = `test-insurance-${Date.now()}`;
  const message = createTestMessage("I need insurance for my car", testPhone);
  
  try {
    await orchestrator.processMessage(message);
    
    const { data: session } = await supabase
      .from("agent_chat_sessions")
      .select("agent_type")
      .eq("user_phone", testPhone)
      .single();
    
    assertEquals(session?.agent_type, "insurance");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Agent Routing: Waiter Agent", async () => {
  const testPhone = `test-waiter-${Date.now()}`;
  const message = createTestMessage("I want to order food", testPhone);
  
  try {
    await orchestrator.processMessage(message);
    
    const { data: session } = await supabase
      .from("agent_chat_sessions")
      .select("agent_type")
      .eq("user_phone", testPhone)
      .single();
    
    assertEquals(session?.agent_type, "waiter");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Agent Routing: Farmer Agent", async () => {
  const testPhone = `test-farmer-${Date.now()}`;
  const message = createTestMessage("I have crops to sell", testPhone);
  
  try {
    await orchestrator.processMessage(message);
    
    const { data: session } = await supabase
      .from("agent_chat_sessions")
      .select("agent_type")
      .eq("user_phone", testPhone)
      .single();
    
    assertEquals(session?.agent_type, "farmer");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Agent Routing: Business Broker Agent", async () => {
  const testPhone = `test-broker-${Date.now()}`;
  const message = createTestMessage("looking for a business to buy", testPhone);
  
  try {
    await orchestrator.processMessage(message);
    
    const { data: session } = await supabase
      .from("agent_chat_sessions")
      .select("agent_type")
      .eq("user_phone", testPhone)
      .single();
    
    assertEquals(session?.agent_type, "business_broker");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Session Persistence: Continues conversation with same agent", async () => {
  const testPhone = `test-session-${Date.now()}`;
  
  try {
    // First message - establish jobs agent
    await orchestrator.processMessage(
      createTestMessage("find me a job", testPhone)
    );
    
    // Second message - should continue with jobs agent
    await orchestrator.processMessage(
      createTestMessage("what about software roles?", testPhone)
    );
    
    const { data: session } = await supabase
      .from("agent_chat_sessions")
      .select("agent_type, conversation_history")
      .eq("user_phone", testPhone)
      .single();
    
    assertEquals(session?.agent_type, "jobs");
    
    // Should have multiple messages in history
    const history = session?.conversation_history || [];
    assert(history.length >= 2, "Should have conversation history");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("User Creation: Creates whatsapp_users entry", async () => {
  const testPhone = `test-user-${Date.now()}`;
  const message = createTestMessage("hello", testPhone);
  
  try {
    await orchestrator.processMessage(message);
    
    const { data: user } = await supabase
      .from("whatsapp_users")
      .select("*")
      .eq("phone_number", testPhone)
      .single();
    
    assertExists(user);
    assertEquals(user.phone_number, testPhone);
    assertEquals(user.preferred_language, "en");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Message Storage: Stores inbound message", async () => {
  const testPhone = `test-msg-${Date.now()}`;
  const messageBody = "test message for storage";
  const message = createTestMessage(messageBody, testPhone);
  
  try {
    await orchestrator.processMessage(message);
    
    // Check if message was stored
    const { data: messages } = await supabase
      .from("whatsapp_messages")
      .select("body, direction")
      .eq("body", messageBody)
      .limit(1);
    
    assertExists(messages);
    assert(messages.length > 0, "Should have stored message");
    assertEquals(messages[0].body, messageBody);
    assertEquals(messages[0].direction, "inbound");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Intent Storage: Creates intent record", async () => {
  const testPhone = `test-intent-${Date.now()}`;
  const message = createTestMessage("find software job in Kigali", testPhone);
  
  try {
    await orchestrator.processMessage(message);
    
    // Check if intent was stored
    const { data: intents } = await supabase
      .from("ai_agent_intents")
      .select("intent_type, structured_payload")
      .order("created_at", { ascending: false })
      .limit(1);
    
    assertExists(intents);
    assert(intents.length > 0, "Should have created intent");
    assertEquals(intents[0].intent_type, "search_jobs");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Conversation History: Maintains last 10 messages", async () => {
  const testPhone = `test-history-${Date.now()}`;
  
  try {
    // Send multiple messages
    for (let i = 0; i < 12; i++) {
      await orchestrator.processMessage(
        createTestMessage(`message ${i}`, testPhone)
      );
    }
    
    const { data: session } = await supabase
      .from("agent_chat_sessions")
      .select("conversation_history")
      .eq("user_phone", testPhone)
      .single();
    
    const history = session?.conversation_history || [];
    
    // Should maintain limited history
    assert(history.length <= 20, "History should be limited (10 user + 10 assistant)");
    assert(history.length > 0, "Should have history");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Response Generation: Creates outbound message", async () => {
  const testPhone = `test-response-${Date.now()}`;
  const message = createTestMessage("need a job", testPhone);
  
  try {
    await orchestrator.processMessage(message);
    
    // Check for outbound response
    const { data: messages } = await supabase
      .from("whatsapp_messages")
      .select("direction, message_type")
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1);
    
    assertExists(messages);
    assert(messages.length > 0, "Should have generated response");
    assertEquals(messages[0].direction, "outbound");
  } finally {
    await cleanup(testPhone);
  }
});
