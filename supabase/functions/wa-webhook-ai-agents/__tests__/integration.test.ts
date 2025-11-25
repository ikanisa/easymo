/**
 * Integration Tests for wa-webhook-ai-agents
 * Tests end-to-end message flow
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/wa-webhook-ai-agents`;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  SERVICE_ROLE_KEY ?? ""
);

// Helper to create WhatsApp webhook payload
function createWebhookPayload(messageText: string, from = `test-${Date.now()}`): any {
  return {
    object: "whatsapp_business_account",
    entry: [{
      id: "test-entry",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: "15551234567",
            phone_number_id: "test-phone-id"
          },
          messages: [{
            from,
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            type: "text",
            text: {
              body: messageText
            }
          }]
        },
        field: "messages"
      }]
    }]
  };
}

// Helper to send webhook request
async function sendWebhook(payload: any): Promise<Response> {
  return await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "X-WA-Internal-Forward": "true", // Bypass signature check for testing
    },
    body: JSON.stringify(payload)
  });
}

// Cleanup helper
async function cleanup(phoneNumber: string) {
  await supabase.from("agent_chat_sessions").delete().eq("user_phone", phoneNumber);
  await supabase.from("whatsapp_users").delete().eq("phone_number", phoneNumber);
}

Deno.test("Integration: Health check endpoint", async () => {
  const response = await fetch(`${WEBHOOK_URL}/health`);
  assertEquals(response.status, 200);
  
  const body = await response.json();
  assertEquals(body.service, "wa-webhook-ai-agents");
  assertEquals(body.version, "3.0.0");
  assertExists(body.features);
  assertEquals(body.features.agentOrchestrator, true);
  assertEquals(body.features.intentParsing, true);
  assertEquals(body.features.multiAgent, true);
});

Deno.test("Integration: Complete jobs search flow", async () => {
  const testPhone = `test-jobs-flow-${Date.now()}`;
  const payload = createWebhookPayload("find software job in Kigali", testPhone);
  
  try {
    const response = await sendWebhook(payload);
    
    assertEquals(response.status, 200);
    
    const body = await response.json();
    assertEquals(body.success, true);
    assertEquals(body.messageProcessed, true);
    
    // Wait a moment for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify session was created
    const { data: session } = await supabase
      .from("agent_chat_sessions")
      .select("*")
      .eq("user_phone", testPhone)
      .single();
    
    assertExists(session);
    assertEquals(session.agent_type, "jobs");
    
    // Verify user was created
    const { data: user } = await supabase
      .from("whatsapp_users")
      .select("*")
      .eq("phone_number", testPhone)
      .single();
    
    assertExists(user);
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Integration: Complete rides booking flow", async () => {
  const testPhone = `test-rides-flow-${Date.now()}`;
  const payload = createWebhookPayload("need ride from airport to downtown now", testPhone);
  
  try {
    const response = await sendWebhook(payload);
    
    assertEquals(response.status, 200);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify rides agent was selected
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

Deno.test("Integration: Complete insurance quote flow", async () => {
  const testPhone = `test-insurance-flow-${Date.now()}`;
  const payload = createWebhookPayload("third party insurance for my motorcycle plate RAD123", testPhone);
  
  try {
    const response = await sendWebhook(payload);
    
    assertEquals(response.status, 200);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify insurance agent was selected
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

Deno.test("Integration: Conversation continuity", async () => {
  const testPhone = `test-continuity-${Date.now()}`;
  
  try {
    // First message
    await sendWebhook(createWebhookPayload("find job in software", testPhone));
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Second message (should continue with jobs agent)
    await sendWebhook(createWebhookPayload("what about senior positions?", testPhone));
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify still on jobs agent
    const { data: session } = await supabase
      .from("agent_chat_sessions")
      .select("agent_type, conversation_history")
      .eq("user_phone", testPhone)
      .single();
    
    assertEquals(session?.agent_type, "jobs");
    
    // Should have conversation history
    const history = session?.conversation_history || [];
    assert(history.length >= 2, "Should have conversation history");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Integration: Event logging", async () => {
  const testPhone = `test-events-${Date.now()}`;
  const payload = createWebhookPayload("test message", testPhone);
  
  try {
    await sendWebhook(payload);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if event was logged
    const { data: events } = await supabase
      .from("wa_ai_agent_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    
    assertExists(events);
    assert(events.length > 0, "Should have logged event");
    assertExists(events[0].correlation_id);
    assertExists(events[0].payload);
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Integration: Rate limiting (if implemented)", async () => {
  const testPhone = `test-rate-limit-${Date.now()}`;
  
  try {
    // Send multiple requests rapidly
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(sendWebhook(createWebhookPayload(`message ${i}`, testPhone)));
    }
    
    const responses = await Promise.all(promises);
    
    // All should succeed (rate limiting not strictly enforced yet)
    responses.forEach(response => {
      assert(response.status === 200 || response.status === 429);
    });
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Integration: Correlation ID propagation", async () => {
  const testPhone = `test-correlation-${Date.now()}`;
  const correlationId = `test-correlation-${Date.now()}`;
  const payload = createWebhookPayload("test", testPhone);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "X-Correlation-ID": correlationId,
        "X-WA-Internal-Forward": "true",
      },
      body: JSON.stringify(payload)
    });
    
    assertEquals(response.status, 200);
    assertEquals(response.headers.get("X-Correlation-ID"), correlationId);
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Integration: Request ID generation", async () => {
  const testPhone = `test-request-id-${Date.now()}`;
  const payload = createWebhookPayload("test", testPhone);
  
  try {
    const response = await sendWebhook(payload);
    
    assertEquals(response.status, 200);
    
    const requestId = response.headers.get("X-Request-ID");
    assertExists(requestId);
    
    // Should be a UUID
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    assert(uuidPattern.test(requestId), "Request ID should be a UUID");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Integration: Response headers", async () => {
  const testPhone = `test-headers-${Date.now()}`;
  const payload = createWebhookPayload("test", testPhone);
  
  try {
    const response = await sendWebhook(payload);
    
    assertEquals(response.status, 200);
    assertEquals(response.headers.get("Content-Type"), "application/json");
    assertEquals(response.headers.get("X-Service"), "wa-webhook-ai-agents");
  } finally {
    await cleanup(testPhone);
  }
});

Deno.test("Integration: Agent switch on new topic", async () => {
  const testPhone = `test-switch-${Date.now()}`;
  
  try {
    // Start with jobs
    await sendWebhook(createWebhookPayload("find job", testPhone));
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Switch to insurance (explicit keyword)
    await sendWebhook(createWebhookPayload("actually I need insurance instead", testPhone));
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data: session } = await supabase
      .from("agent_chat_sessions")
      .select("agent_type")
      .eq("user_phone", testPhone)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .single();
    
    // Should have switched to insurance based on keyword
    assertEquals(session?.agent_type, "insurance");
  } finally {
    await cleanup(testPhone);
  }
});
