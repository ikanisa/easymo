/**
 * Claims Flow Tests
 * Tests for insurance claims processing
 */

import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { createTestSuite } from "../../_shared/testing/test-utils.ts";

const CLAIM_TYPES = [
  "claim_accident",
  "claim_theft",
  "claim_damage",
  "claim_third_party",
];

function isValidClaimType(type: string): boolean {
  return CLAIM_TYPES.includes(type);
}

function validateDescription(description: string): { valid: boolean; error?: string } {
  if (!description || description.trim().length < 10) {
    return { valid: false, error: "Description must be at least 10 characters" };
  }
  if (description.length > 5000) {
    return { valid: false, error: "Description must be less than 5000 characters" };
  }
  return { valid: true };
}

const claimTypeSuite = createTestSuite("Claims - Type Validation");

claimTypeSuite.test("validates all claim types", () => {
  CLAIM_TYPES.forEach((type) => {
    assertEquals(isValidClaimType(type), true, `${type} should be valid`);
  });
});

claimTypeSuite.test("rejects invalid claim types", () => {
  assertEquals(isValidClaimType("claim_fire"), false);
  assertEquals(isValidClaimType("invalid"), false);
  assertEquals(isValidClaimType(""), false);
});

const descriptionSuite = createTestSuite("Claims - Description Validation");

descriptionSuite.test("accepts valid description", () => {
  const result = validateDescription("This is a detailed description of the incident.");
  assertEquals(result.valid, true);
});

descriptionSuite.test("rejects too short description", () => {
  const result = validateDescription("Short");
  assertEquals(result.valid, false);
  assertEquals(result.error, "Description must be at least 10 characters");
});

descriptionSuite.test("rejects empty description", () => {
  const result = validateDescription("");
  assertEquals(result.valid, false);
});

descriptionSuite.test("rejects too long description", () => {
  const result = validateDescription("a".repeat(5001));
  assertEquals(result.valid, false);
  assertEquals(result.error, "Description must be less than 5000 characters");
});

console.log("✅ Claims flow tests loaded");
