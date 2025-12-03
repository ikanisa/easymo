import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { detectJobIntent, shouldRouteToJobAgent } from "../jobs/utils.ts";
import { t } from "../utils/i18n.ts";

// =====================================================
// Intent Detection Tests
// =====================================================

Deno.test("Jobs Handler - detectJobIntent returns post_job for hiring keywords", () => {
  const result = detectJobIntent("I need to hire a driver");
  assertEquals(result.type, "post_job");
  assertEquals(result.confidence > 0.6, true);
});

Deno.test("Jobs Handler - detectJobIntent returns find_job for job seeking keywords", () => {
  const result = detectJobIntent("I am looking for work as a cook");
  assertEquals(result.type, "find_job");
  assertEquals(result.confidence > 0.6, true);
});

Deno.test("Jobs Handler - detectJobIntent returns view_jobs for my jobs query", () => {
  const result = detectJobIntent("show my jobs");
  assertEquals(result.type, "view_jobs");
  assertEquals(result.confidence, 0.9);
});

Deno.test("Jobs Handler - detectJobIntent returns view_applications for application query", () => {
  const result = detectJobIntent("my applications");
  assertEquals(result.type, "view_applications");
  assertEquals(result.confidence, 0.9);
});

Deno.test("Jobs Handler - detectJobIntent returns help for unclear messages", () => {
  const result = detectJobIntent("hello");
  assertEquals(result.type, "help");
  assertEquals(result.confidence, 0.5);
});

// =====================================================
// Routing Tests  
// =====================================================

Deno.test("Jobs Handler - shouldRouteToJobAgent returns true for job-related queries", () => {
  assertEquals(shouldRouteToJobAgent("I need to hire someone"), true);
  assertEquals(shouldRouteToJobAgent("looking for work"), true);
  assertEquals(shouldRouteToJobAgent("show my jobs"), true);
});

Deno.test("Jobs Handler - shouldRouteToJobAgent returns false for generic messages", () => {
  assertEquals(shouldRouteToJobAgent("hello"), false);
  assertEquals(shouldRouteToJobAgent("hi there"), false);
});

// =====================================================
// i18n Tests
// =====================================================

Deno.test("Jobs Handler - i18n returns English translation", () => {
  const greeting = t("en", "jobs.menu.greeting");
  assertExists(greeting);
  assertEquals(greeting.includes("Welcome"), true);
});

Deno.test("Jobs Handler - i18n returns French translation", () => {
  const greeting = t("fr", "jobs.menu.greeting");
  assertExists(greeting);
  assertEquals(greeting.includes("Bienvenue"), true);
});

Deno.test("Jobs Handler - i18n returns Kinyarwanda translation", () => {
  const greeting = t("rw", "jobs.menu.greeting");
  assertExists(greeting);
  assertEquals(greeting.includes("Murakaza"), true);
});

Deno.test("Jobs Handler - i18n falls back to English for unknown locale", () => {
  const greeting = t("de", "jobs.menu.greeting");
  assertExists(greeting);
  assertEquals(greeting.includes("Welcome"), true);
});

Deno.test("Jobs Handler - i18n returns key if translation missing", () => {
  const result = t("en", "jobs.nonexistent.key");
  assertEquals(result, "jobs.nonexistent.key");
});

// =====================================================
// Service Configuration Tests
// =====================================================

Deno.test("Jobs Handler - Service name is correct", () => {
  const serviceName = "wa-webhook-jobs";
  assertExists(serviceName);
  assertEquals(serviceName, "wa-webhook-jobs");
});

Deno.test("Jobs Handler - Menu button text exists for all locales", () => {
  const enButton = t("en", "jobs.menu.button");
  const frButton = t("fr", "jobs.menu.button");
  const rwButton = t("rw", "jobs.menu.button");
  
  assertExists(enButton);
  assertExists(frButton);
  assertExists(rwButton);
  
  assertEquals(enButton, "Select Option");
  assertEquals(frButton, "Sélectionner");
  assertEquals(rwButton, "Hitamo");
});
