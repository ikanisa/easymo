/**
 * Tests for Fallback System
 * 
 * Validates:
 * - Scoring algorithms
 * - Error classification
 * - Fallback data integrity
 * - Pagination logic
 */

import { describe, expect,it } from "vitest";

import {
  classifyError,
  createFallbackResponse,
  FallbackErrorType,
  filterBySearch,
  getUserMessage,
  paginateFallback,
  rankItems,
  scoreItem,
} from "@/lib/agents/fallback-system";

describe("Fallback System", () => {
  describe("scoreItem", () => {
    it("should score items with all quality signals", () => {
      const item = {
        rating: 5,
        verified: true,
        totalReviews: 200,
        updatedAt: new Date().toISOString(),
      };
      
      const score = scoreItem(item);
      expect(score).toBeGreaterThan(0.9);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should handle missing fields", () => {
      const item = {};
      const score = scoreItem(item);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it("should give bonus for verified items", () => {
      const verified = scoreItem({ verified: true });
      const unverified = scoreItem({ verified: false });
      expect(verified).toBeGreaterThan(unverified);
    });
  });

  describe("filterBySearch", () => {
    const items = [
      { name: "Apple Store", location: "Kigali" },
      { name: "Banana Market", location: "Nyamirambo" },
      { name: "Orange Shop", location: "Kigali City" },
    ];

    it("should filter by name", () => {
      const result = filterBySearch(items, "apple", ["name"]);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Apple Store");
    });

    it("should filter by multiple fields", () => {
      const result = filterBySearch(items, "kigali", ["name", "location"]);
      expect(result).toHaveLength(2);
    });

    it("should return all items when no search term", () => {
      const result = filterBySearch(items, undefined, ["name"]);
      expect(result).toHaveLength(3);
    });

    it("should be case insensitive", () => {
      const result = filterBySearch(items, "BANANA", ["name"]);
      expect(result).toHaveLength(1);
    });
  });

  describe("createFallbackResponse", () => {
    it("should create properly structured response", () => {
      const data = [{ id: 1 }, { id: 2 }];
      const response = createFallbackResponse(
        data,
        "test_target",
        "Test message",
        "Test remediation"
      );

      expect(response.data).toEqual(data);
      expect(response.total).toBe(2);
      expect(response.hasMore).toBe(false);
      expect(response.integration.status).toBe("degraded");
      expect(response.integration.target).toBe("test_target");
      expect(response.integration.timestamp).toBeDefined();
    });
  });

  describe("classifyError", () => {
    it("should classify timeout errors", () => {
      const error = { message: "Request timeout" };
      expect(classifyError(error)).toBe(FallbackErrorType.TIMEOUT);
    });

    it("should classify auth errors", () => {
      const error = { message: "Unauthorized access" };
      expect(classifyError(error)).toBe(FallbackErrorType.AUTH_ERROR);
    });

    it("should classify network errors", () => {
      const error = { message: "Network fetch failed" };
      expect(classifyError(error)).toBe(FallbackErrorType.NETWORK_ERROR);
    });

    it("should classify query errors", () => {
      const error = { code: "PGRST", message: "Database error" };
      expect(classifyError(error)).toBe(FallbackErrorType.QUERY_FAILED);
    });

    it("should default to unknown for unclassified errors", () => {
      const error = { message: "Something weird happened" };
      expect(classifyError(error)).toBe(FallbackErrorType.UNKNOWN);
    });
  });

  describe("getUserMessage", () => {
    it("should provide user-friendly messages", () => {
      const message = getUserMessage(FallbackErrorType.SUPABASE_UNAVAILABLE);
      expect(message).toContain("Database service");
      expect(message).toContain("cached");
    });

    it("should handle all error types", () => {
      Object.values(FallbackErrorType).forEach((errorType) => {
        const message = getUserMessage(errorType as FallbackErrorType);
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(10);
      });
    });
  });

  describe("paginateFallback", () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));

    it("should paginate correctly", () => {
      const result = paginateFallback(items, 10, 0);
      expect(result.data).toHaveLength(10);
      expect(result.total).toBe(100);
      expect(result.hasMore).toBe(true);
    });

    it("should handle last page", () => {
      const result = paginateFallback(items, 10, 95);
      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(false);
    });

    it("should use default limit", () => {
      const result = paginateFallback(items);
      expect(result.data).toHaveLength(50);
    });
  });

  describe("rankItems", () => {
    const items = [
      { id: 1, rating: 3 },
      { id: 2, rating: 5 },
      { id: 3, rating: 4 },
    ];

    it("should rank by score function", () => {
      const ranked = rankItems(items, (item) => item.rating);
      expect(ranked[0].id).toBe(2); // rating 5
      expect(ranked[1].id).toBe(3); // rating 4
      expect(ranked[2].id).toBe(1); // rating 3
    });

    it("should limit to topN", () => {
      const ranked = rankItems(items, (item) => item.rating, 2);
      expect(ranked).toHaveLength(2);
      expect(ranked[0].id).toBe(2);
    });
  });
});
