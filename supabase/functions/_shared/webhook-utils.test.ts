/**
 * Tests for webhook utilities
 * 
 * Run with: deno test --allow-env --allow-net supabase/functions/_shared/webhook-utils.test.ts
 */

import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js.39.0";
import { createHmac } from "https://deno.land/std@0.224.0/node/crypto.ts";
import {
  WEBHOOK_TIMEOUT_MS,
  MAX_RETRIES,
  processWithTimeout,
  verifyWebhookSignature,
  validateWebhookPayload,
  RateLimiter,
  Logger,
  Metrics,
  CircuitBreaker
} from "./webhook-utils.ts";
import { ValidationError } from "./errors.ts";

// Helper function
function createSignature(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.toString("hex")}`;
}

Deno.test("Constants are defined", () => {
  assertEquals(WEBHOOK_TIMEOUT_MS, 10000);
  assertEquals(MAX_RETRIES, 3);
});

Deno.test("processWithTimeout - should resolve within timeout", async () => {
  const result = await processWithTimeout(
    async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return "success";
    },
    1000,
    "test-correlation-id"
  );
  
  assertEquals(result, "success");
});

Deno.test("processWithTimeout - should reject on timeout", async () => {
  let errorThrown = false;
  
  try {
    await processWithTimeout(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return "success";
      },
      500,
      "test-correlation-id"
    );
  } catch (error) {
    errorThrown = true;
    assertExists(error);
    assertEquals(error instanceof Error, true);
    if (error instanceof Error) {
      assertEquals(error.message.includes("timeout"), true);
    }
  }
  
  assertEquals(errorThrown, true);
});

// ============================================
// SIGNATURE VERIFICATION TESTS
// ============================================

Deno.test("Webhook Signature Verification", async (t) => {
  const secret = "test_secret_key";
  const payload = '{"test": "data"}';
  
  await t.step("should verify valid signature", async () => {
    const signature = createSignature(payload, secret);
    const result = await verifyWebhookSignature(payload, signature, secret);
    assertEquals(result, true);
  });

  await t.step("should reject invalid signature", async () => {
    const result = await verifyWebhookSignature(payload, "sha256=invalid_hash", secret);
    assertEquals(result, false);
  });

  await t.step("should reject missing signature", async () => {
    const result = await verifyWebhookSignature(payload, null, secret);
    assertEquals(result, false);
  });
});

// ============================================
// PAYLOAD VALIDATION TESTS
// ============================================

Deno.test("Webhook Payload Validation", async (t) => {
  await t.step("should validate valid text message", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "123456",
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "+1234567890",
              phone_number_id: "phone123"
            },
            messages: [{
              from: "9876543210",
              id: "msg123",
              timestamp: "1234567890",
              type: "text",
              text: { body: "Hello World" }
            }]
          }
        }]
      }]
    };

    const result = validateWebhookPayload(payload);
    assertExists(result);
  });

  await t.step("should reject invalid object", () => {
    const payload = {
      object: "invalid",
      entry: []
    };

    let error;
    try {
      validateWebhookPayload(payload);
    } catch (e) {
      error = e;
    }
    assertExists(error);
  });
});
