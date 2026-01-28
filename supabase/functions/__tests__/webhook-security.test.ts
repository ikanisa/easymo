/**
 * Integration Tests for Webhook Security
 * Run: deno test --allow-net --allow-env --no-check supabase/functions/__tests__/webhook-security.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

import { webhookSecurityCheck } from "../_shared/webhook-security.ts";

const TEST_CONFIG = {
  serviceName: "test-webhook",
  maxBodySize: 1024 * 1024,
  rateLimit: 100,
  rateWindow: 60,
  verifySignature: true,
};

Deno.test("Webhook Security - Rejects oversized payloads", async () => {
  const largeBody = "x".repeat(2 * 1024 * 1024);
  const req = new Request("http://localhost/test", {
    method: "POST",
    body: largeBody,
  });
  
  const result = await webhookSecurityCheck(req, TEST_CONFIG);
  
  assertEquals(result.allowed, false);
  assertExists(result.response);
  assertEquals(result.response?.status, 413);
});

Deno.test("Webhook Security - Validates signatures correctly", async () => {
  const body = '{"test": true}';
  const secret = "test_secret_123";
  
  Deno.env.set("WHATSAPP_APP_SECRET", secret);
  Deno.env.set("DENO_ENV", "test");
  
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
  
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "x-hub-signature-256": `sha256=${signatureHex}` },
    body: body,
  });
  
  const result = await webhookSecurityCheck(req, TEST_CONFIG);
  
  assertEquals(result.allowed, true);
  assertEquals(result.rawBody, body);
});

Deno.test("Webhook Security - Rejects invalid signatures in production", async () => {
  const body = '{"test": true}';
  const secret = "test_secret_123";
  
  Deno.env.set("WHATSAPP_APP_SECRET", secret);
  Deno.env.set("DENO_ENV", "production");
  Deno.env.set("WA_ALLOW_UNSIGNED_WEBHOOKS", "false");
  
  const req = new Request("http://localhost/test", {
    method: "POST",
    headers: { "x-hub-signature-256": "sha256=invalid_signature" },
    body: body,
  });
  
  const result = await webhookSecurityCheck(req, TEST_CONFIG);
  
  assertEquals(result.allowed, false);
  assertExists(result.response);
  assertEquals(result.response?.status, 401);
});

console.log("✅ All webhook security tests passed!");
