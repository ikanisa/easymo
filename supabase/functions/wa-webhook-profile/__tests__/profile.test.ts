/**
 * Profile Management Tests
 * Tests for user profile operations
 */

import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { createTestSuite } from "../../_shared/testing/test-utils.ts";

type ProfileUpdateData = {
  full_name?: string;
  email?: string;
  language?: string;
};

function validateProfileUpdate(data: ProfileUpdateData): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (data.full_name !== undefined) {
    if (data.full_name.trim().length < 2) {
      errors.full_name = "Name must be at least 2 characters";
    }
    if (data.full_name.length > 100) {
      errors.full_name = "Name must be less than 100 characters";
    }
  }

  if (data.email !== undefined) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(data.email)) {
      errors.email = "Invalid email format";
    }
  }

  if (data.language !== undefined) {
    const validLanguages = ["en", "fr", "rw", "sw"];
    if (!validLanguages.includes(data.language)) {
      errors.language = "Unsupported language";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

const validationSuite = createTestSuite("Profile - Validation");

validationSuite.test("accepts valid full name", () => {
  const result = validateProfileUpdate({ full_name: "John Doe" });
  assertEquals(result.valid, true);
});

validationSuite.test("rejects too short name", () => {
  const result = validateProfileUpdate({ full_name: "J" });
  assertEquals(result.valid, false);
  assertEquals(result.errors.full_name, "Name must be at least 2 characters");
});

validationSuite.test("accepts valid email", () => {
  const result = validateProfileUpdate({ email: "john@example.com" });
  assertEquals(result.valid, true);
});

validationSuite.test("rejects invalid email", () => {
  const result = validateProfileUpdate({ email: "not-an-email" });
  assertEquals(result.valid, false);
  assertEquals(result.errors.email, "Invalid email format");
});

validationSuite.test("accepts valid language", () => {
  ["en", "fr", "rw", "sw"].forEach((lang) => {
    const result = validateProfileUpdate({ language: lang });
    assertEquals(result.valid, true, `Language ${lang} should be valid`);
  });
});

validationSuite.test("rejects unsupported language", () => {
  const result = validateProfileUpdate({ language: "de" });
  assertEquals(result.valid, false);
  assertEquals(result.errors.language, "Unsupported language");
});

console.log("✅ Profile management tests loaded");
