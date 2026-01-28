/**
 * Budget Enforcer Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    checkMoltbotBudget,
    checkOcrBudget,
    checkVendorOutreachBudget,
    checkTimeToShortlistBudget,
    checkAllBudgets,
    getBudgetExceededAction,
    BUDGET_LIMITS,
} from "../../src/audit/budgetEnforcer";

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => mockClient),
}));

// Mock logger
vi.mock("@easymo/commons", () => ({
    childLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
}));

const mockClient = {
    from: vi.fn(),
};

const mockSelect = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
};

describe("Budget Enforcer", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.SUPABASE_URL = "https://test.supabase.co";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    });

    afterEach(() => {
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    describe("BUDGET_LIMITS", () => {
        it("should have correct limits defined", () => {
            expect(BUDGET_LIMITS.MOLTBOT_CALLS).toBe(8);
            expect(BUDGET_LIMITS.OCR_CALLS).toBe(2);
            expect(BUDGET_LIMITS.VENDOR_TOTAL).toBe(15);
            expect(BUDGET_LIMITS.TIME_TO_SHORTLIST_TARGET_MS).toBe(6 * 60 * 1000);
            expect(BUDGET_LIMITS.TIME_TO_SHORTLIST_MAX_MS).toBe(10 * 60 * 1000);
        });
    });

    describe("checkMoltbotBudget", () => {
        it("should allow when under budget", async () => {
            mockClient.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
                    }),
                }),
            });

            const result = await checkMoltbotBudget("request-123");

            expect(result.allowed).toBe(true);
            expect(result.current).toBe(3);
            expect(result.limit).toBe(8);
        });

        it("should deny when at budget limit", async () => {
            mockClient.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ count: 8, error: null }),
                    }),
                }),
            });

            const result = await checkMoltbotBudget("request-123");

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("moltbot_budget_exceeded");
            expect(result.current).toBe(8);
        });

        it("should deny when over budget limit", async () => {
            mockClient.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
                    }),
                }),
            });

            const result = await checkMoltbotBudget("request-123");

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("moltbot_budget_exceeded");
        });
    });

    describe("checkOcrBudget", () => {
        it("should allow when under OCR limit", async () => {
            mockClient.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
                    }),
                }),
            });

            const result = await checkOcrBudget("request-123");

            expect(result.allowed).toBe(true);
            expect(result.current).toBe(1);
            expect(result.limit).toBe(2);
        });

        it("should deny when OCR limit reached", async () => {
            mockClient.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
                    }),
                }),
            });

            const result = await checkOcrBudget("request-123");

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("ocr_budget_exceeded");
        });
    });

    describe("checkVendorOutreachBudget", () => {
        it("should allow when under vendor limit", async () => {
            mockClient.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
                }),
            });

            const result = await checkVendorOutreachBudget("request-123");

            expect(result.allowed).toBe(true);
            expect(result.current).toBe(10);
            expect(result.limit).toBe(15);
        });

        it("should deny when vendor limit reached", async () => {
            mockClient.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ count: 15, error: null }),
                }),
            });

            const result = await checkVendorOutreachBudget("request-123");

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("vendor_budget_exceeded");
        });
    });

    describe("getBudgetExceededAction", () => {
        it("should return fallback for moltbot budget", () => {
            const action = getBudgetExceededAction("moltbot_budget_exceeded");

            expect(action.action).toBe("fallback");
            expect((action as { message: string }).message).toContain("trouble processing");
        });

        it("should return fallback for ocr budget", () => {
            const action = getBudgetExceededAction("ocr_budget_exceeded");

            expect(action.action).toBe("fallback");
            expect((action as { message: string }).message).toContain("images");
        });

        it("should return handoff for time budget", () => {
            const action = getBudgetExceededAction("time_budget_exceeded");

            expect(action.action).toBe("handoff");
            expect((action as { options: string[] }).options).toHaveLength(2);
        });

        it("should return queue_human for unknown budget", () => {
            const action = getBudgetExceededAction("unknown_budget");

            expect(action.action).toBe("queue_human");
            expect((action as { reason: string }).reason).toBe("unknown_budget");
        });
    });
});
