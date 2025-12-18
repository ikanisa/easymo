/**
 * Error Handling Tests
 * Tests for error handling utilities
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  formatUnknownError,
  classifyError,
  serializeError,
} from "../wa-webhook-shared/utils/error-handling.ts";

describe("Error Handling", () => {
  describe("formatUnknownError", () => {
    it("should format Error object", () => {
      const error = new Error("Test error");
      assertEquals(formatUnknownError(error), "Test error");
    });

    it("should format string", () => {
      assertEquals(formatUnknownError("String error"), "String error");
    });

    it("should format object with message", () => {
      assertEquals(formatUnknownError({ message: "Object error" }), "Object error");
    });

    it("should format plain object", () => {
      const result = formatUnknownError({ code: "ERR", data: "test" });
      assertEquals(typeof result, "string");
      assertEquals(result.includes("ERR"), true);
    });
  });

  describe("classifyError", () => {
    it("should classify validation error", () => {
      const result = classifyError(new Error("validation failed"));
      assertEquals(result.isUserError, true);
      assertEquals(result.statusCode, 400);
    });

    it("should classify database error", () => {
      const result = classifyError(new Error("database connection failed"));
      assertEquals(result.isSystemError, true);
      assertEquals(result.statusCode, 503);
    });

    it("should classify generic error", () => {
      const result = classifyError(new Error("unknown error"));
      assertEquals(result.isUserError, false);
      assertEquals(result.isSystemError, false);
      assertEquals(result.statusCode, 500);
    });

    it("should classify not found error", () => {
      const result = classifyError(new Error("resource not found"));
      assertEquals(result.isUserError, true);
      assertEquals(result.statusCode, 400);
    });
  });

  describe("serializeError", () => {
    it("should serialize Error object", () => {
      const error = new Error("Test error");
      error.stack = "stack trace";
      const result = serializeError(error);
      assertEquals(result.message, "Test error");
      assertEquals(result.stack, "stack trace");
    });

    it("should serialize object with message", () => {
      const result = serializeError({ message: "Object error", code: "ERR" });
      assertEquals(result.message, "Object error");
      assertEquals(result.code, "ERR");
    });

    it("should serialize string", () => {
      const result = serializeError("String error");
      assertEquals(result.message, "String error");
    });
  });
});

