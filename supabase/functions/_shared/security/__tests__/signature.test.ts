/**
 * Signature Verification Tests
 */

import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";

import {
  extractSignatureMetadata,
  verifySignature,
  verifyWebhookRequest,
} from "../signature.ts";

const TEST_SECRET = "test_secret_key_12345";

async function createSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body)
  );
  const hash = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hash}`;
}

function createMockRequest(
  body: string,
  headers: Record<string, string> = {}
): Request {
  return new Request("https://example.com/webhook", {
    method: "POST",
    headers: new Headers(headers),
    body,
  });
}

Deno.test("verifySignature - valid SHA256 signature", async () => {
  const body = JSON.stringify({ test: "data" });
  const signature = await createSignature(body, TEST_SECRET);
  
  const result = await verifySignature(body, signature, TEST_SECRET);
  assertEquals(result, true);
});

Deno.test("verifySignature - invalid signature", async () => {
  const body = JSON.stringify({ test: "data" });
  const wrongSignature = "sha256=0000000000000000000000000000000000000000000000000000000000000000";
  
  const result = await verifySignature(body, wrongSignature, TEST_SECRET);
  assertEquals(result, false);
});

Deno.test("verifySignature - wrong secret", async () => {
  const body = JSON.stringify({ test: "data" });
  const signature = await createSignature(body, TEST_SECRET);
  
  const result = await verifySignature(body, signature, "wrong_secret");
  assertEquals(result, false);
});

Deno.test("extractSignatureMetadata - x-hub-signature-256 header", () => {
  const req = createMockRequest("{}", {
    "x-hub-signature-256": "sha256=abc123def456",
  });
  
  const meta = extractSignatureMetadata(req);
  assertEquals(meta.provided, true);
  assertEquals(meta.header, "x-hub-signature-256");
  assertEquals(meta.method, "sha256");
});

Deno.test("verifyWebhookRequest - valid request", async () => {
  const body = JSON.stringify({ object: "whatsapp_business_account" });
  const signature = await createSignature(body, TEST_SECRET);
  const req = createMockRequest(body, {
    "x-hub-signature-256": signature,
  });
  
  const result = await verifyWebhookRequest(req, body, "test-service", {
    appSecret: TEST_SECRET,
  });
  
  assertEquals(result.valid, true);
  assertEquals(result.reason, "valid");
});

console.log("✅ Signature verification tests defined");
