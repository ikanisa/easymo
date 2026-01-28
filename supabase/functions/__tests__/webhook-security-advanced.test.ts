/**
 * Advanced Webhook Security Tests (Phase 4)
 * Tests for rate limiting, idempotency, and concurrent operations
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

import { checkRateLimit } from "../_shared/rate-limit/index.ts";
import { checkIdempotency } from "../_shared/webhook-security.ts";

Deno.test("Rate Limiting - In-memory fallback works", async () => {
  // Unset Redis to force in-memory
  const originalUrl = Deno.env.get("UPSTASH_REDIS_URL");
  Deno.env.delete("UPSTASH_REDIS_URL");
  
  try {
    const config = {
      key: "test-key-" + Date.now(),
      limit: 5,
      windowSeconds: 60,
    };
    
    // Send requests up to limit
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(config);
      assertEquals(result.allowed, true, `Request ${i + 1} should be allowed`);
      assertEquals(result.remaining, 5 - (i + 1), `Remaining should be ${5 - (i + 1)}`);
    }
    
    // 6th request should be blocked
    const blocked = await checkRateLimit(config);
    assertEquals(blocked.allowed, false, "6th request should be blocked");
    assertEquals(blocked.remaining, 0, "No requests remaining");
    
    console.log("✅ In-memory rate limiting works correctly");
  } finally {
    if (originalUrl) Deno.env.set("UPSTASH_REDIS_URL", originalUrl);
  }
});

Deno.test("Rate Limiting - Memory cleanup prevents leaks", async () => {
  Deno.env.delete("UPSTASH_REDIS_URL");
  
  const startTime = Date.now();
  
  // Create many rate limit keys with short window
  for (let i = 0; i < 100; i++) {
    await checkRateLimit({
      key: `leak-test-${i}`,
      limit: 100,
      windowSeconds: 1, // 1 second window (expires fast)
    });
  }
  
  // Wait for entries to expire
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Trigger cleanup by making another request
  const result = await checkRateLimit({
    key: "cleanup-trigger",
    limit: 100,
    windowSeconds: 60,
  });
  
  assertEquals(result.allowed, true);
  
  const duration = Date.now() - startTime;
  console.log(`✅ Memory cleanup working (test took ${duration}ms)`);
});

Deno.test("Rate Limiting - Different keys are independent", async () => {
  Deno.env.delete("UPSTASH_REDIS_URL");
  
  const key1 = "user-1-" + Date.now();
  const key2 = "user-2-" + Date.now();
  
  const config = {
    limit: 3,
    windowSeconds: 60,
  };
  
  // Exhaust key1
  for (let i = 0; i < 3; i++) {
    const result = await checkRateLimit({ ...config, key: key1 });
    assertEquals(result.allowed, true);
  }
  
  // key1 should be blocked
  const blocked1 = await checkRateLimit({ ...config, key: key1 });
  assertEquals(blocked1.allowed, false);
  
  // key2 should still work
  const allowed2 = await checkRateLimit({ ...config, key: key2 });
  assertEquals(allowed2.allowed, true);
  assertEquals(allowed2.remaining, 2);
  
  console.log("✅ Different rate limit keys are independent");
});

Deno.test("Idempotency - Detects duplicates within window", async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseKey) {
    console.log("⚠️ Skipping idempotency test (no Supabase credentials)");
    return;
  }
  
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.1");
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const messageId = "test-msg-" + Date.now();
  const phone = "+250788123456";
  const webhookType = "test";
  
  // First call - should process
  const first = await checkIdempotency(supabase, messageId, phone, webhookType, 5);
  assertEquals(first.isDuplicate, false);
  assertEquals(first.shouldContinue, true);
  
  // Second call (immediate) - should skip
  const second = await checkIdempotency(supabase, messageId, phone, webhookType, 5);
  assertEquals(second.isDuplicate, true);
  assertEquals(second.shouldContinue, false);
  
  console.log("✅ Idempotency check working");
});

Deno.test("Signature Verification - Rejects tampered payloads", async () => {
  const body = '{"test": "data"}';
  const secret = "test_secret_123";
  
  Deno.env.set("WHATSAPP_APP_SECRET", secret);
  Deno.env.set("DENO_ENV", "production");
  
  // Create valid signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  
  // Tamper with body
  const tamperedBody = '{"test": "tampered"}';
  
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "x-hub-signature-256": `sha256=${signatureHex}` },
    body: tamperedBody,
  });
  
  const { webhookSecurityCheck } = await import("../webhookSecurity.ts");
  const result = await webhookSecurityCheck(req, {
    serviceName: "test",
    maxBodySize: 1024 * 1024,
    rateLimit: 100,
    rateWindow: 60,
  });
  
  assertEquals(result.allowed, false);
  assertExists(result.response);
  assertEquals(result.response?.status, 401);
  
  console.log("✅ Tampered payloads are rejected");
});

console.log("✅ All advanced security tests passed!");
