/**
 * Tests for MessageDeduplicator
 */

import { describe, it, expect, beforeEach } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { MessageDeduplicator, type MessageMetadata } from "./message-deduplicator.ts";

// Mock Supabase client
function createMockSupabase(mockData: any = null, mockError: any = null) {
  return {
    from: (table: string) => ({
      select: (columns: string, options?: any) => ({
        eq: (column: string, value: any) => ({
          maybeSingle: async () => ({ data: mockData, error: mockError }),
          data: mockData,
          count: mockData?.length || 0,
          error: mockError,
        }),
        lt: (column: string, value: any) => ({
          select: (cols: string) => ({
            data: mockData,
            error: mockError,
          }),
        }),
      }),
      insert: async (data: any) => ({ error: mockError }),
      delete: () => ({
        lt: (column: string, value: any) => ({
          select: (cols: string) => ({
            data: mockData,
            error: mockError,
          }),
        }),
      }),
    }),
  } as any;
}

describe("MessageDeduplicator", () => {
  const testMetadata: MessageMetadata = {
    messageId: "test-msg-123",
    from: "+250788123456",
    type: "text",
    timestamp: "2025-12-01T10:00:00Z",
    body: "Hello",
  };

  describe("isDuplicate", () => {
    it("should return true when message exists", async () => {
      const mockSupabase = createMockSupabase({ message_id: "test-msg-123" });
      const deduplicator = new MessageDeduplicator(mockSupabase);
      
      const result = await deduplicator.isDuplicate("test-msg-123");
      expect(result).toBe(true);
    });

    it("should return false when message does not exist", async () => {
      const mockSupabase = createMockSupabase(null);
      const deduplicator = new MessageDeduplicator(mockSupabase);
      
      const result = await deduplicator.isDuplicate("test-msg-123");
      expect(result).toBe(false);
    });

    it("should return false on database error", async () => {
      const mockSupabase = createMockSupabase(null, { message: "DB error" });
      const deduplicator = new MessageDeduplicator(mockSupabase);
      
      const result = await deduplicator.isDuplicate("test-msg-123");
      expect(result).toBe(false);
    });
  });

  describe("checkMessage", () => {
    it("should return detailed info for duplicate message", async () => {
      const mockSupabase = createMockSupabase([{
        message_id: "test-msg-123",
        timestamp: "2025-12-01T10:00:00Z",
      }]);
      const deduplicator = new MessageDeduplicator(mockSupabase);
      
      const result = await deduplicator.checkMessage("test-msg-123");
      expect(result.isDuplicate).toBe(true);
      expect(result.messageId).toBe("test-msg-123");
      expect(result.processedCount).toBe(1);
    });

    it("should return non-duplicate info for new message", async () => {
      const mockSupabase = createMockSupabase([]);
      const deduplicator = new MessageDeduplicator(mockSupabase);
      
      const result = await deduplicator.checkMessage("test-msg-123");
      expect(result.isDuplicate).toBe(false);
      expect(result.processedCount).toBe(0);
    });
  });

  describe("recordMessage", () => {
    it("should record message without error", async () => {
      const mockSupabase = createMockSupabase();
      const deduplicator = new MessageDeduplicator(mockSupabase);
      
      // Should not throw
      await deduplicator.recordMessage(testMetadata);
    });

    it("should handle unique constraint violations gracefully", async () => {
      const mockSupabase = createMockSupabase(null, { code: "23505" });
      const deduplicator = new MessageDeduplicator(mockSupabase);
      
      // Should not throw
      await deduplicator.recordMessage(testMetadata);
    });
  });

  describe("shouldProcess", () => {
    it("should return true for new message", async () => {
      const mockSupabase = createMockSupabase([]);
      const deduplicator = new MessageDeduplicator(mockSupabase);
      
      const result = await deduplicator.shouldProcess(testMetadata);
      expect(result).toBe(true);
    });

    it("should return false for duplicate message", async () => {
      const mockSupabase = createMockSupabase([{
        message_id: "test-msg-123",
        timestamp: "2025-12-01T10:00:00Z",
      }]);
      const deduplicator = new MessageDeduplicator(mockSupabase);
      
      const result = await deduplicator.shouldProcess(testMetadata);
      expect(result).toBe(false);
    });
  });
});
