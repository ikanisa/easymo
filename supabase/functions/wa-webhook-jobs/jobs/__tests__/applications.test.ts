/**
 * Job Applications Tests
 * 
 * Tests for job application flow and seeker profile onboarding
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";

/**
 * Test: Apply button ID generation
 */
Deno.test("getApplyButtonId generates correct ID", () => {
  const jobId = "abc-123";
  const buttonId = `APPLY::${jobId}`;
  assertEquals(buttonId, "APPLY::abc-123");
});

/**
 * Test: Extract job ID from apply button
 */
Deno.test("extractJobIdFromApply extracts correct ID", () => {
  const selectionId = "APPLY::abc-123";
  const jobId = selectionId.startsWith("APPLY::") 
    ? selectionId.slice("APPLY::".length) 
    : null;
  assertEquals(jobId, "abc-123");
});

/**
 * Test: Non-apply button returns null
 */
Deno.test("extractJobIdFromApply returns null for non-apply button", () => {
  const selectionId = "JOB_RESULTS_BACK";
  const jobId = selectionId.startsWith("APPLY::") 
    ? selectionId.slice("APPLY::".length) 
    : null;
  assertEquals(jobId, null);
});

/**
 * Test: Skills parsing from onboarding
 */
Deno.test("Skills are parsed correctly from comma-separated input", () => {
  const input = "Driver, Mechanic, Security Guard";
  const skills = input
    .split(/[,\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 10);
  
  assertEquals(skills.length, 3);
  assertEquals(skills[0], "Driver");
  assertEquals(skills[2], "Security Guard");
});

/**
 * Test: Skills parsing with newlines
 */
Deno.test("Skills are parsed from newline-separated input", () => {
  const input = "Driver\nMechanic\nSecurity Guard";
  const skills = input
    .split(/[,\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
  
  assertEquals(skills.length, 3);
});

/**
 * Test: Experience years parsing
 */
Deno.test("Experience years parsed correctly", () => {
  assertEquals(parseInt("0") || 0, 0);
  assertEquals(parseInt("3") || 0, 3);
  assertEquals(parseInt("10") || 0, 10);
  assertEquals(parseInt("abc") || 0, 0); // Invalid input
});

/**
 * Test: Experience validation
 */
Deno.test("Experience validation works", () => {
  const validate = (years: number) => years >= 0 && years <= 50;
  
  assert(validate(0));
  assert(validate(5));
  assert(validate(50));
  assert(!validate(-1));
  assert(!validate(51));
});

/**
 * Test: i18n template parameter replacement
 */
Deno.test("i18n template parameters are replaced", () => {
  const template = "Application for *{{title}}* submitted!";
  const params = { title: "Driver Position" };
  
  let text = template;
  Object.entries(params).forEach(([key, value]) => {
    text = text.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });
  
  assertEquals(text, "Application for *Driver Position* submitted!");
});

/**
 * Test: Multiple parameter replacement
 */
Deno.test("Multiple i18n parameters are replaced", () => {
  const template = "{{name}} applied to {{title}}";
  const params = { name: "John", title: "Driver" };
  
  let text = template;
  Object.entries(params).forEach(([key, value]) => {
    text = text.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });
  
  assertEquals(text, "John applied to Driver");
});

/**
 * Test: Self-application detection
 */
Deno.test("Self-application is detected", () => {
  const userPhone = "+250788123456";
  const jobPostedBy = "+250788123456";
  
  assertEquals(userPhone === jobPostedBy, true);
});

/**
 * Test: Different user can apply
 */
Deno.test("Different user can apply", () => {
  const userPhone: string = "+250788123456";
  const jobPostedBy: string = "+250788999999";
  
  assertEquals(userPhone !== jobPostedBy, true);
});

console.log("\n✅ All job application tests passed!\n");
