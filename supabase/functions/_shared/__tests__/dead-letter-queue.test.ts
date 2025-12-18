/**
 * Dead Letter Queue Tests
 * Tests for DLQ functionality
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { describe, it, beforeEach, afterEach } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  addToDeadLetterQueue,
  getRetriableMessages,
  markMessageProcessed,
} from "../dead-letter-queue.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// Mock Supabase client for testing
const mockSupabase = {
  from: () => ({
    insert: () => ({
      select: () => Promise.resolve({ data: [{ id: "test-id" }], error: null }),
    }),
    select: () => ({
      eq: () => ({
        lt: () => ({
          lte: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }),
    update: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  }),
} as any;

describe("Dead Letter Queue", () => {
  it("should add message to DLQ", async () => {
    const result = await addToDeadLetterQueue(
      mockSupabase,
      {
        message_id: "test-msg-123",
        from_number: "+250788123456",
        payload: { test: "data" },
        error_message: "Test error",
      },
      "test-correlation-id"
    );

    // Should not throw
    assertEquals(result, undefined);
  });

  it("should get retriable messages", async () => {
    const messages = await getRetriableMessages(mockSupabase, 10);
    assertEquals(Array.isArray(messages), true);
  });

  it("should mark message as processed", async () => {
    await markMessageProcessed(mockSupabase, "test-id", true);
    // Should not throw
  });
});

