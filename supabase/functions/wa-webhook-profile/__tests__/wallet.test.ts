/**
 * Wallet Tests
 * Tests for wallet operations and token transfers
 */

import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { createMockSupabase, createTestSuite } from "../../_shared/testing/test-utils.ts";

function validateTransferAmount(amount: number): { valid: boolean; error?: string } {
  if (typeof amount !== "number" || isNaN(amount)) {
    return { valid: false, error: "Amount must be a number" };
  }
  if (amount <= 0) {
    return { valid: false, error: "Amount must be greater than 0" };
  }
  if (amount > 1000000) {
    return { valid: false, error: "Amount exceeds maximum transfer limit" };
  }
  if (!Number.isInteger(amount)) {
    return { valid: false, error: "Amount must be a whole number" };
  }
  return { valid: true };
}

const amountSuite = createTestSuite("Wallet - Amount Validation");

amountSuite.test("accepts valid transfer amount", () => {
  const result = validateTransferAmount(1000);
  assertEquals(result.valid, true);
});

amountSuite.test("rejects zero amount", () => {
  const result = validateTransferAmount(0);
  assertEquals(result.valid, false);
  assertEquals(result.error, "Amount must be greater than 0");
});

amountSuite.test("rejects negative amount", () => {
  const result = validateTransferAmount(-100);
  assertEquals(result.valid, false);
});

amountSuite.test("rejects amount over limit", () => {
  const result = validateTransferAmount(1000001);
  assertEquals(result.valid, false);
  assertEquals(result.error, "Amount exceeds maximum transfer limit");
});

amountSuite.test("rejects decimal amount", () => {
  const result = validateTransferAmount(100.50);
  assertEquals(result.valid, false);
  assertEquals(result.error, "Amount must be a whole number");
});

amountSuite.test("rejects NaN amount", () => {
  const result = validateTransferAmount(NaN);
  assertEquals(result.valid, false);
  assertEquals(result.error, "Amount must be a number");
});

const balanceSuite = createTestSuite("Wallet - Balance Checks");

balanceSuite.test("allows transfer when balance is sufficient", () => {
  const canTransfer = (balance: number, amount: number) => balance >= amount;
  assertEquals(canTransfer(10000, 5000), true);
  assertEquals(canTransfer(5000, 5000), true);
  assertEquals(canTransfer(1000, 5000), false);
});

console.log("✅ Wallet tests loaded");
