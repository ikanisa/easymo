/**
 * Input Validation Tests
 */

import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import {
  sanitizeString,
  sanitizePhoneNumber,
  isValidPhoneNumber,
  isValidEmail,
  isValidUUID,
  hasSQLInjectionPatterns,
  hasXSSPatterns,
  validateInput,
  COMMON_SCHEMAS,
} from "../input-validator.ts";

Deno.test("sanitizeString - removes null bytes", () => {
  const input = "hello\0world";
  const result = sanitizeString(input);
  assertEquals(result, "helloworld");
});

Deno.test("sanitizeString - trims whitespace", () => {
  const input = "  hello world  ";
  const result = sanitizeString(input);
  assertEquals(result, "hello world");
});

Deno.test("sanitizePhoneNumber - keeps digits and leading +", () => {
  const input = "+1 (555) 123-4567";
  const result = sanitizePhoneNumber(input);
  assertEquals(result, "+15551234567");
});

Deno.test("isValidPhoneNumber - valid E.164 format", () => {
  assertEquals(isValidPhoneNumber("+15551234567"), true);
  assertEquals(isValidPhoneNumber("+250788123456"), true);
});

Deno.test("isValidPhoneNumber - invalid formats", () => {
  assertEquals(isValidPhoneNumber("5551234567"), false);
  assertEquals(isValidPhoneNumber(""), false);
});

Deno.test("isValidEmail - valid emails", () => {
  assertEquals(isValidEmail("test@example.com"), true);
  assertEquals(isValidEmail("user.name@domain.co.rw"), true);
});

Deno.test("isValidEmail - invalid emails", () => {
  assertEquals(isValidEmail("invalid"), false);
  assertEquals(isValidEmail("@example.com"), false);
});

Deno.test("isValidUUID - valid UUIDs", () => {
  assertEquals(isValidUUID("123e4567-e89b-12d3-a456-426614174000"), true);
});

Deno.test("hasSQLInjectionPatterns - detects injection", () => {
  assertEquals(hasSQLInjectionPatterns("SELECT * FROM users"), true);
  assertEquals(hasSQLInjectionPatterns("'; DROP TABLE users; --"), true);
});

Deno.test("hasSQLInjectionPatterns - allows normal text", () => {
  assertEquals(hasSQLInjectionPatterns("Hello world"), false);
});

Deno.test("hasXSSPatterns - detects script tags", () => {
  assertEquals(hasXSSPatterns("<script>alert('xss')</script>"), true);
});

Deno.test("validateInput - validates required fields", () => {
  const schema = {
    name: { type: "string" as const, required: true },
  };
  
  const result = validateInput({}, schema);
  assertEquals(result.valid, false);
});

Deno.test("validateInput - validates phone number", () => {
  const schema = {
    phone: { type: "phone" as const, required: true },
  };
  
  const result = validateInput({ phone: "+250788123456" }, schema);
  assertEquals(result.valid, true);
});

Deno.test("validateInput - rejects SQL injection", () => {
  const schema = {
    name: { type: "string" as const },
  };
  
  const result = validateInput(
    { name: "'; DROP TABLE users; --" },
    schema,
    { logViolations: false }
  );
  assertEquals(result.valid, false);
});

console.log("✅ Input validation tests defined");
