/**
 * Tests for webhook utilities
 * 
 * Run with: deno test --allow-env --allow-net supabase/functions/_shared/webhook-utils.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  WEBHOOK_TIMEOUT_MS,
  MAX_RETRIES,
  processWithTimeout,
} from "./webhook-utils.ts";

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
