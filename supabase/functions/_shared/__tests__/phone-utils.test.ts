/**
 * Phone Utils Tests
 * Tests for phone number utilities
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  normalizePhone,
  maskPhone,
  isValidPhone,
  getCountryCode,
  mapCountryCode,
} from "../phone-utils.ts";

describe("Phone Utils", () => {
  describe("normalizePhone", () => {
    it("should normalize phone with dashes", () => {
      assertEquals(normalizePhone("+250-788-123-456"), "+250788123456");
    });

    it("should normalize phone without plus", () => {
      assertEquals(normalizePhone("250788123456"), "250788123456");
    });

    it("should handle empty string", () => {
      assertEquals(normalizePhone(""), "");
    });

    it("should preserve leading plus", () => {
      assertEquals(normalizePhone("+250788123456"), "+250788123456");
    });

    it("should remove spaces and special chars", () => {
      assertEquals(normalizePhone("+250 788 123 456"), "+250788123456");
    });
  });

  describe("maskPhone", () => {
    it("should mask phone number", () => {
      const masked = maskPhone("+250788123456");
      assertEquals(masked, "+250****456");
    });

    it("should handle null", () => {
      assertEquals(maskPhone(null), "***");
    });

    it("should handle undefined", () => {
      assertEquals(maskPhone(undefined), "***");
    });

    it("should handle short numbers", () => {
      assertEquals(maskPhone("123"), "***");
    });

    it("should use custom visible lengths", () => {
      const masked = maskPhone("+250788123456", 7, 3);
      assertEquals(masked, "+250788***456");
    });
  });

  describe("isValidPhone", () => {
    it("should validate valid phone", () => {
      assertEquals(isValidPhone("+250788123456"), true);
    });

    it("should reject too short", () => {
      assertEquals(isValidPhone("123"), false);
    });

    it("should reject too long", () => {
      assertEquals(isValidPhone("+250788123456789012345"), false);
    });

    it("should reject empty", () => {
      assertEquals(isValidPhone(""), false);
    });

    it("should validate without plus", () => {
      assertEquals(isValidPhone("250788123456"), true);
    });
  });

  describe("getCountryCode", () => {
    it("should extract Rwanda code", () => {
      assertEquals(getCountryCode("+250788123456"), "250");
    });

    it("should extract US code", () => {
      assertEquals(getCountryCode("+1555123456"), "1");
    });

    it("should return null for no plus", () => {
      assertEquals(getCountryCode("250788123456"), null);
    });

    it("should handle UK code", () => {
      assertEquals(getCountryCode("+447911123456"), "44");
    });
  });

  describe("mapCountryCode", () => {
    it("should always return RW", () => {
      assertEquals(mapCountryCode("250"), "RW");
      assertEquals(mapCountryCode("1"), "RW");
      assertEquals(mapCountryCode(null), "RW");
    });
  });
});

