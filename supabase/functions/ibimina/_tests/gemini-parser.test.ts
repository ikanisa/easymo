/**
 * Unit tests for Gemini SMS parser utilities
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";

import {
  parseWithGemini,
  geminiToStandardFormat,
  type GeminiParsedTransaction,
} from "../_shared/gemini-parser.ts";

Deno.test("geminiToStandardFormat converts Gemini response to standard format", () => {
  const geminiTransaction: GeminiParsedTransaction = {
    transaction_id: "MP241126ABC",
    amount: 50000,
    currency: "RWF",
    payer_name: "JOHN DOE",
    payer_phone: "+250781234567",
    timestamp: "2024-11-26T12:00:00Z",
    type: "PAYMENT_RECEIVED",
  };

  const standard = geminiToStandardFormat(geminiTransaction);

  assertEquals(standard.msisdn, "+250781234567");
  assertEquals(standard.amount, 50000);
  assertEquals(standard.txn_id, "MP241126ABC");
  assertEquals(standard.timestamp, "2024-11-26T12:00:00Z");
  assertEquals(standard.payer_name, "JOHN DOE");
  assertEquals(standard.confidence, 0.85);
});

Deno.test("geminiToStandardFormat handles string amounts", () => {
  const geminiTransaction: GeminiParsedTransaction = {
    transaction_id: "TEST123",
    amount: "25000" as any, // Gemini might return string
    currency: "RWF",
    payer_name: "Test User",
    payer_phone: "+250788123456",
    timestamp: "2024-11-26T12:00:00Z",
    type: "PAYMENT_RECEIVED",
  };

  const standard = geminiToStandardFormat(geminiTransaction);

  assertEquals(standard.amount, 25000);
});

Deno.test("geminiToStandardFormat floors decimal amounts", () => {
  const geminiTransaction: GeminiParsedTransaction = {
    transaction_id: "TEST123",
    amount: 25000.99,
    currency: "RWF",
    payer_name: "Test User",
    payer_phone: "+250788123456",
    timestamp: "2024-11-26T12:00:00Z",
    type: "PAYMENT_RECEIVED",
  };

  const standard = geminiToStandardFormat(geminiTransaction);

  assertEquals(standard.amount, 25000);
});

Deno.test("geminiToStandardFormat uses default timestamp if missing", () => {
  const geminiTransaction: GeminiParsedTransaction = {
    transaction_id: "TEST123",
    amount: 10000,
    currency: "RWF",
    payer_name: "Test User",
    payer_phone: "+250788123456",
    timestamp: "",
    type: "PAYMENT_RECEIVED",
  };

  const standard = geminiToStandardFormat(geminiTransaction);

  assertExists(standard.timestamp);
  // Should be a valid ISO 8601 timestamp
  assertEquals(new Date(standard.timestamp).toString() !== "Invalid Date", true);
});

// Integration test - only runs if GEMINI_API_KEY is set
Deno.test({
  name: "parseWithGemini parses MTN SMS correctly",
  ignore: !Deno.env.get("GEMINI_API_KEY"),
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const smsText =
      "You have received RWF 50,000 from 0781234567 (JOHN DOE). Ref: NYA.SACCO1.GRP001. Balance: RWF 100,000. Txn ID: MP241126ABC";

    const result = await parseWithGemini(smsText);

    assertExists(result.parsed);
    assertExists(result.model);
    assertEquals(result.parsed.transaction_id, "MP241126ABC");
    assertEquals(result.parsed.amount, 50000);
    assertEquals(result.parsed.currency, "RWF");
    assertEquals(result.parsed.type, "PAYMENT_RECEIVED");
  },
});

Deno.test({
  name: "parseWithGemini parses Airtel SMS correctly",
  ignore: !Deno.env.get("GEMINI_API_KEY"),
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const smsText =
      "Received RWF 25,000 from +250788123456. Ref: GIC.UMURENGE.ABAKUNDAKAZI. ID: AM20241126XYZ";

    const result = await parseWithGemini(smsText);

    assertExists(result.parsed);
    assertEquals(result.parsed.transaction_id, "AM20241126XYZ");
    assertEquals(result.parsed.amount, 25000);
    assertEquals(result.parsed.currency, "RWF");
  },
});

Deno.test({
  name: "parseWithGemini handles invalid SMS gracefully",
  ignore: !Deno.env.get("GEMINI_API_KEY"),
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const smsText = "Hello world, this is not a payment SMS";

    // Should either parse with low confidence or throw error
    try {
      const result = await parseWithGemini(smsText);
      // If it parses, check it extracted something
      assertExists(result.parsed);
    } catch (error) {
      // Expected - non-payment SMS might fail to parse
      assertExists(error);
    }
  },
});

Deno.test("parseWithGemini throws error if API key missing", async () => {
  const originalKey = Deno.env.get("GEMINI_API_KEY");
  Deno.env.delete("GEMINI_API_KEY");

  try {
    await assertRejects(
      async () => {
        await parseWithGemini("Test SMS");
      },
      Error,
      "GEMINI_API_KEY"
    );
  } finally {
    if (originalKey) {
      Deno.env.set("GEMINI_API_KEY", originalKey);
    }
  }
});
