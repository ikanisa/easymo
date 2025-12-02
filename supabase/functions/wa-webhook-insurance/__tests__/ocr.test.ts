/**
 * OCR Processing Tests
 * Tests for insurance document OCR functionality
 */

import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { createTestSuite } from "../../_shared/testing/test-utils.ts";

type InsuranceExtraction = {
  policy_number?: string | null;
  insurer_name?: string | null;
  vehicle_plate?: string | null;
  coverage_type?: string | null;
  expiry_date?: string | null;
};

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function normalizePlate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim().toUpperCase();
  return str.replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ");
}

function normalizeCoverage(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim().toLowerCase();
  
  if (str.includes("comprehensive") || str.includes("full")) return "comprehensive";
  if (str.includes("third party") || str.includes("tp")) return "third_party";
  
  return str;
}

const normalizationSuite = createTestSuite("OCR - Data Normalization");

normalizationSuite.test("normalizes policy number", () => {
  assertEquals(normalizeString("POL-123"), "POL-123");
  assertEquals(normalizeString("  POL-456  "), "POL-456");
  assertEquals(normalizeString(""), null);
  assertEquals(normalizeString(null), null);
});

normalizationSuite.test("normalizes vehicle plate to uppercase", () => {
  assertEquals(normalizePlate("rab 123a"), "RAB 123A");
  assertEquals(normalizePlate("RAC-456-B"), "RAC 456 B");
  assertEquals(normalizePlate(""), null);
});

normalizationSuite.test("normalizes coverage type", () => {
  assertEquals(normalizeCoverage("Comprehensive Cover"), "comprehensive");
  assertEquals(normalizeCoverage("Third Party Only"), "third_party");
  assertEquals(normalizeCoverage("Full Coverage"), "comprehensive");
});

normalizationSuite.test("handles null and undefined", () => {
  assertEquals(normalizeString(null), null);
  assertEquals(normalizeString(undefined), null);
  assertEquals(normalizePlate(null), null);
  assertEquals(normalizeCoverage(undefined), null);
});

console.log("✅ OCR processing tests loaded");
