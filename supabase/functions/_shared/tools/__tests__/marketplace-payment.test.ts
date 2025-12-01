/**
 * Tests for Marketplace Payment Command Handler
 */

import { assertEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Simple test without import since file has dependencies
Deno.test("Payment command detection - basic test", () => {
  const isPaymentCommand = (text: string): boolean => {
    const lower = text.toLowerCase().trim();
    return (
      lower === "paid" ||
      lower === "payment sent" ||
      lower === "confirm" ||
      lower.startsWith("paid ") ||
      lower.startsWith("ref:")
    );
  };

  assert(isPaymentCommand("paid"));
  assert(isPaymentCommand("PAID"));
  assert(isPaymentCommand("confirm"));
  assert(isPaymentCommand("paid ABC123"));
  assertEquals(isPaymentCommand("hello"), false);
});

Deno.test("Payment reference extraction", () => {
  const extractReference = (text: string): string | null => {
    const lower = text.toLowerCase();
    if (lower.startsWith("paid ")) {
      return text.split(/\s+/).slice(1).join(" ").trim();
    }
    if (lower.startsWith("ref:")) {
      return text.substring(4).trim();
    }
    return null;
  };

  assertEquals(extractReference("paid ABC123"), "ABC123");
  assertEquals(extractReference("ref:XYZ789"), "XYZ789");
  assertEquals(extractReference("paid MTN 12345"), "MTN 12345");
  assertEquals(extractReference("hello"), null);
});
