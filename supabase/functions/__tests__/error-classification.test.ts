/**
 * Error Classification Tests (Phase 3/4)
 * Tests for error categorization and formatting
 */

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  classifyError,
  type ErrorCategory,
  formatUnknownError,
  getStackTrace,
  isRetryableError} from "../_shared/error-handler.ts";

Deno.test("Error Classification - User errors", () => {
  const userErrors = [
    new Error("Invalid phone number"),
    new Error("User not found"),
    new Error("Unauthorized access"),
    new Error("Bad request"),
    new Error("Validation failed"),
    new Error("Missing required field"),
  ];
  
  for (const error of userErrors) {
    const category = classifyError(error);
    assertEquals(category, "user_error", `"${error.message}" should be user_error`);
  }
  
  console.log("✅ User errors classified correctly");
});

Deno.test("Error Classification - System errors", () => {
  const systemErrors = [
    new Error("Database connection failed"),
    new Error("Internal server error"),
    new Error("Panic: out of memory"),
    new Error("500 Internal Server Error"),
    new Error("Stack overflow"),
    new Error("Database query timeout"),
  ];
  
  for (const error of systemErrors) {
    const category = classifyError(error);
    assertEquals(category, "system_error", `"${error.message}" should be system_error`);
  }
  
  console.log("✅ System errors classified correctly");
});

Deno.test("Error Classification - External errors", () => {
  const externalErrors = [
    new Error("Timeout waiting for response"),
    new Error("Network error"),
    new Error("Upstream service unavailable"),
    new Error("Connection refused"),
    new Error("ECONNREFUSED"),
    new Error("503 Service Unavailable"),
    new Error("504 Gateway Timeout"),
    new Error("429 Too Many Requests"),
  ];
  
  for (const error of externalErrors) {
    const category = classifyError(error);
    assertEquals(category, "external_error", `"${error.message}" should be external_error`);
  }
  
  console.log("✅ External errors classified correctly");
});

Deno.test("Error Classification - Unknown errors", () => {
  const unknownErrors = [
    new Error("Something weird happened"),
    new Error("Unexpected state"),
  ];
  
  for (const error of unknownErrors) {
    const category = classifyError(error);
    assertEquals(category, "unknown", `"${error.message}" should be unknown`);
  }
  
  console.log("✅ Unknown errors classified correctly");
});

Deno.test("isRetryableError - Only external errors are retryable", () => {
  const retryable = [
    new Error("Timeout waiting for response"),
    new Error("Network error"),
    new Error("503 Service Unavailable"),
    new Error("ECONNREFUSED"),
  ];
  
  for (const error of retryable) {
    assertEquals(isRetryableError(error), true, `"${error.message}" should be retryable`);
  }
  
  const notRetryable = [
    new Error("Invalid input"),
    new Error("User not found"),
    new Error("Database error"),
  ];
  
  for (const error of notRetryable) {
    assertEquals(isRetryableError(error), false, `"${error.message}" should NOT be retryable`);
  }
  
  console.log("✅ Retryable error detection working");
});

Deno.test("formatUnknownError - Handles all types", () => {
  // Error object
  assertEquals(formatUnknownError(new Error("test error")), "test error");
  
  // String
  assertEquals(formatUnknownError("string error"), "string error");
  
  // Object with message
  assertEquals(formatUnknownError({ message: "object error" }), "object error");
  
  // Object without message
  const obj = { code: 123, details: "info" };
  assertEquals(formatUnknownError(obj), JSON.stringify(obj));
  
  // Null/undefined
  assertEquals(formatUnknownError(null), "null");
  assertEquals(formatUnknownError(undefined), "undefined");
  
  // Number
  assertEquals(formatUnknownError(404), "404");
  
  console.log("✅ Error formatting handles all types");
});

Deno.test("getStackTrace - Extracts stack traces", () => {
  const errorWithStack = new Error("test error");
  const stack = getStackTrace(errorWithStack);
  
  assertEquals(typeof stack, "string");
  assertEquals(stack?.includes("test error"), true);
  
  // Non-error types
  assertEquals(getStackTrace("string"), null);
  assertEquals(getStackTrace({ message: "no stack" }), null);
  assertEquals(getStackTrace(null), null);
  
  console.log("✅ Stack trace extraction working");
});

Deno.test("Error Categories - Complete coverage", () => {
  const categories: ErrorCategory[] = ["user_error", "system_error", "external_error", "unknown"];
  
  const examples: Record<ErrorCategory, string[]> = {
    user_error: ["Invalid input", "Not found", "Unauthorized"],
    system_error: ["Database error", "Internal error", "500"],
    external_error: ["Timeout", "Network error", "503"],
    unknown: ["Random message"],
  };
  
  for (const category of categories) {
    for (const message of examples[category]) {
      const result = classifyError(new Error(message));
      assertEquals(result, category, `"${message}" should be ${category}`);
    }
  }
  
  console.log("✅ All error categories covered");
});

console.log("✅ All error classification tests passed!");
