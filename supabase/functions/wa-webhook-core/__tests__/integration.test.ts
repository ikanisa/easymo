/**
 * Integration tests for wa-webhook-core routing
 * Tests end-to-end routing flows including circuit breaker and DLQ
 * 
 * NOTE: These tests require environment variables and are skipped in CI
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Skip integration tests if environment variables are not set
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SKIP_INTEGRATION = !SUPABASE_URL || !SERVICE_ROLE_KEY;

if (SKIP_INTEGRATION) {
  console.log("⚠️  Skipping integration tests - environment variables not set");
  Deno.exit(0);
}

const CORE_URL = `${SUPABASE_URL}/functions/v1/wa-webhook-core`;

function createTestPayload(messageText: string, from = "1234567890"): any {
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

async function sendWebhook(payload: any, extraHeaders: Record<string, string> = {}): Promise<Response> {
  return await fetch(CORE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "X-WA-Internal-Forward": "true", // Bypass signature check
      ...extraHeaders
    },
    body: JSON.stringify(payload)
  });
}

Deno.test("Health check returns service status", async () => {
  const response = await fetch(`${CORE_URL}/health`);
  assertEquals(response.status, 200);
  
  const body = await response.json();
  assertEquals(body.service, "wa-webhook-core");
  assertExists(body.timestamp);
  assertExists(body.checks);
  assertExists(body.microservices);
});

Deno.test("Keyword routing - 'rides' routes to mobility service", async () => {
  const payload = createTestPayload("rides");
  const response = await sendWebhook(payload);
  
  assertEquals(response.status, 200);
  
  const routedService = response.headers.get("X-Routed-Service");
  assertEquals(routedService, "wa-webhook-mobility");
});

Deno.test("Keyword routing - 'insurance' routes to insurance service", async () => {
  const payload = createTestPayload("insurance");
  const response = await sendWebhook(payload);
  
  assertEquals(response.status, 200);
  
  const routedService = response.headers.get("X-Routed-Service");
  assertEquals(routedService, "wa-webhook-insurance");
});

Deno.test("Menu keyword shows home menu", async () => {
  const payload = createTestPayload("menu");
  const response = await sendWebhook(payload);
  
  assertEquals(response.status, 200);
  
  const routedService = response.headers.get("X-Routed-Service");
  assertEquals(routedService, "wa-webhook-core");
});

Deno.test("Home keyword clears session and shows menu", async () => {
  const testPhone = `test-${Date.now()}`;
  
  // First, set an active service
  await supabase
    .from("user_sessions")
    .upsert({
      phone_number: testPhone,
      active_service: "wa-webhook-mobility",
      last_interaction: new Date().toISOString()
    });
  
  // Send "home" keyword
  const payload = createTestPayload("home", testPhone);
  const response = await sendWebhook(payload);
  
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("X-Routed-Service"), "wa-webhook-core");
  
  // Verify session was cleared
  const { data: session } = await supabase
    .from("user_sessions")
    .select("active_service")
    .eq("phone_number", testPhone)
    .maybeSingle();
  
  assertEquals(session?.active_service, null);
  
  // Cleanup
  await supabase.from("user_sessions").delete().eq("phone_number", testPhone);
});

Deno.test("State-based routing - continues conversation in same service", async () => {
  const testPhone = `test-state-${Date.now()}`;
  
  // Set active service
  await supabase
    .from("user_sessions")
    .upsert({
      phone_number: testPhone,
      active_service: "wa-webhook-jobs",
      last_interaction: new Date().toISOString()
    });
  
  // Send arbitrary text (should route to jobs based on state)
  const payload = createTestPayload("I want to apply", testPhone);
  const response = await sendWebhook(payload);
  
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("X-Routed-Service"), "wa-webhook-jobs");
  
  // Cleanup
  await supabase.from("user_sessions").delete().eq("phone_number", testPhone);
});

Deno.test("Unknown text shows home menu (fallback)", async () => {
  const testPhone = `test-fallback-${Date.now()}`;
  const payload = createTestPayload("xyz random text", testPhone);
  
  const response = await sendWebhook(payload);
  
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("X-Routed-Service"), "wa-webhook-core");
  
  // Cleanup
  await supabase.from("user_sessions").delete().eq("phone_number", testPhone);
});

Deno.test("Rate limiting blocks excessive requests", async () => {
  const testPhone = `test-rate-limit-${Date.now()}`;
  const payload = createTestPayload("test", testPhone);
  
  // Send requests until rate limited (default is 60 per minute)
  let rateLimitedResponse: Response | null = null;
  
  for (let i = 0; i < 65; i++) {
    const response = await sendWebhook(payload);
    if (response.status === 429) {
      rateLimitedResponse = response;
      break;
    }
  }
  
  assertExists(rateLimitedResponse, "Should have received 429 rate limit response");
  assertEquals(rateLimitedResponse!.status, 429);
  
  const body = await rateLimitedResponse!.json();
  assertEquals(body.error, "rate_limit_exceeded");
  assertExists(body.retryAfter);
  
  // Cleanup
  await supabase.from("user_sessions").delete().eq("phone_number", testPhone);
});

Deno.test("Correlation ID is propagated", async () => {
  const correlationId = `test-correlation-${Date.now()}`;
  const payload = createTestPayload("menu");
  
  const response = await sendWebhook(payload, {
    "X-Correlation-ID": correlationId
  });
  
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("X-Correlation-ID"), correlationId);
});

Deno.test("Latency header is present", async () => {
  const payload = createTestPayload("menu");
  const response = await sendWebhook(payload);
  
  assertEquals(response.status, 200);
  
  const latencyHeader = response.headers.get("X-WA-Core-Latency");
  assertExists(latencyHeader);
  
  // Should be in format like "123ms"
  const match = latencyHeader?.match(/^\d+ms$/);
  assertExists(match);
});

Deno.test("Request ID is generated if not provided", async () => {
  const payload = createTestPayload("menu");
  const response = await sendWebhook(payload);
  
  assertEquals(response.status, 200);
  
  const requestId = response.headers.get("X-Request-ID");
  assertExists(requestId);
  
  // Should be a UUID
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  assertEquals(uuidPattern.test(requestId!), true);
});
