import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import {
  normalizePhone,
  maskPhone,
  isValidPhone,
  getCountryCode,
} from "./phone-utils.ts";

Deno.test("normalizePhone - removes dashes and spaces", () => {
  assertEquals(normalizePhone("+250-788-123-456"), "+250788123456");
  assertEquals(normalizePhone("250 788 123 456"), "250788123456");
  assertEquals(normalizePhone("+1 555 123 4567"), "+15551234567");
});

Deno.test("normalizePhone - preserves leading plus", () => {
  assertEquals(normalizePhone("+250788123456"), "+250788123456");
  assertEquals(normalizePhone("250788123456"), "250788123456");
});

Deno.test("normalizePhone - handles empty input", () => {
  assertEquals(normalizePhone(""), "");
});

Deno.test("maskPhone - masks middle digits", () => {
  assertEquals(maskPhone("+250788123456"), "+250****456");
  assertEquals(maskPhone("+15551234567"), "+155****567");
});

Deno.test("maskPhone - handles short numbers", () => {
  assertEquals(maskPhone("12345"), "***");
  assertEquals(maskPhone(null), "***");
  assertEquals(maskPhone(undefined), "***");
});

Deno.test("maskPhone - respects custom visible lengths", () => {
  assertEquals(maskPhone("+250788123456", 7, 3), "+250788****456");
  assertEquals(maskPhone("+250788123456", 4, 4), "+250****3456");
});

Deno.test("isValidPhone - validates phone numbers", () => {
  assertEquals(isValidPhone("+250788123456"), true);
  assertEquals(isValidPhone("250788123456"), true);
  assertEquals(isValidPhone("+1555123456"), true);
  assertEquals(isValidPhone("123"), false);
  assertEquals(isValidPhone(""), false);
});

Deno.test("getCountryCode - extracts country codes", () => {
  assertEquals(getCountryCode("+250788123456"), "250");
  assertEquals(getCountryCode("+15551234567"), "1");
  assertEquals(getCountryCode("+447911123456"), "44");
  assertEquals(getCountryCode("+254788123456"), "254");
});

Deno.test("getCountryCode - requires plus prefix", () => {
  assertEquals(getCountryCode("250788123456"), null);
});
