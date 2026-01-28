import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "./logger";

const log = createLogger({ service: "budget-enforcer" });

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
    if (cachedClient) return cachedClient;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    cachedClient = createClient(url, key, { auth: { persistSession: false } });
    return cachedClient;
}

// ============================================================================
// Budget Limits (from .agent/rules/71_cost_controls.md)
// ============================================================================

export const BUDGET_LIMITS = {
    MOLTBOT_CALLS: 8,
    OCR_CALLS: 2,
    VENDOR_BATCHES: 3,
    VENDOR_TOTAL: 15,
    TIME_TO_SHORTLIST_TARGET_MS: 6 * 60 * 1000, // 6 minutes
    TIME_TO_SHORTLIST_MAX_MS: 10 * 60 * 1000, // 10 minutes
} as const;

// ============================================================================
// Types
// ============================================================================

export type BudgetCheckResult = {
    allowed: boolean;
    reason?: string;
    current?: number;
    limit?: number;
    elapsed_ms?: number;
};

export type BudgetExceededAction =
    | { action: "fallback"; message: string }
    | { action: "handoff"; options: string[] }
    | { action: "queue_human"; reason: string };

// ============================================================================
// Budget Check Helpers
// ============================================================================

async function countAuditEvents(
    requestId: string,
    eventType: string,
): Promise<number> {
    const client = getClient();
    if (!client) return 0;

    const { count, error } = await client
        .from("moltbot_audit_events")
        .select("id", { count: "exact", head: true })
        .eq("request_id", requestId)
        .eq("event_type", eventType);

    if (error) {
        log.warn({ msg: "budget_count_failed", error: error.message, requestId, eventType });
        return 0;
    }

    return count ?? 0;
}

async function getRequestCreatedAt(requestId: string): Promise<Date | null> {
    const client = getClient();
    if (!client) return null;

    const { data, error } = await client
        .from("moltbot_marketplace_requests")
        .select("created_at")
        .eq("id", requestId)
        .single();

    if (error || !data) return null;
    return new Date(data.created_at);
}

// ============================================================================
// Budget Checks
// ============================================================================

/**
 * Check if Moltbot call budget is available
 */
export async function checkMoltbotBudget(requestId: string): Promise<BudgetCheckResult> {
    const current = await countAuditEvents(requestId, "moltbot.called");
    const limit = BUDGET_LIMITS.MOLTBOT_CALLS;

    if (current >= limit) {
        log.warn({
            msg: "moltbot_budget_exceeded",
            request_id: requestId,
            current,
            limit,
        });
        return {
            allowed: false,
            reason: "moltbot_budget_exceeded",
            current,
            limit,
        };
    }

    return { allowed: true, current, limit };
}

/**
 * Check if OCR call budget is available
 */
export async function checkOcrBudget(requestId: string): Promise<BudgetCheckResult> {
    const current = await countAuditEvents(requestId, "ocr.job_created");
    const limit = BUDGET_LIMITS.OCR_CALLS;

    if (current >= limit) {
        log.warn({
            msg: "ocr_budget_exceeded",
            request_id: requestId,
            current,
            limit,
        });
        return {
            allowed: false,
            reason: "ocr_budget_exceeded",
            current,
            limit,
        };
    }

    return { allowed: true, current, limit };
}

/**
 * Check if vendor outreach budget is available
 */
export async function checkVendorOutreachBudget(requestId: string): Promise<BudgetCheckResult> {
    const client = getClient();
    if (!client) return { allowed: true, reason: "supabase_not_configured" };

    // Count total vendor outreach records
    const { count, error } = await client
        .from("moltbot_vendor_outreach")
        .select("id", { count: "exact", head: true })
        .eq("request_id", requestId);

    if (error) {
        log.warn({ msg: "vendor_budget_count_failed", error: error.message, requestId });
        return { allowed: true, reason: "count_failed" };
    }

    const current = count ?? 0;
    const limit = BUDGET_LIMITS.VENDOR_TOTAL;

    if (current >= limit) {
        log.warn({
            msg: "vendor_budget_exceeded",
            request_id: requestId,
            current,
            limit,
        });
        return {
            allowed: false,
            reason: "vendor_budget_exceeded",
            current,
            limit,
        };
    }

    return { allowed: true, current, limit };
}

/**
 * Check if time-to-shortlist budget is still available
 */
export async function checkTimeToShortlistBudget(requestId: string): Promise<BudgetCheckResult> {
    const createdAt = await getRequestCreatedAt(requestId);
    if (!createdAt) {
        return { allowed: true, reason: "request_not_found" };
    }

    const elapsed_ms = Date.now() - createdAt.getTime();
    const target = BUDGET_LIMITS.TIME_TO_SHORTLIST_TARGET_MS;
    const max = BUDGET_LIMITS.TIME_TO_SHORTLIST_MAX_MS;

    if (elapsed_ms >= max) {
        log.error({
            msg: "time_budget_exceeded",
            request_id: requestId,
            elapsed_ms,
            max_ms: max,
        });
        return {
            allowed: false,
            reason: "time_budget_exceeded",
            elapsed_ms,
            limit: max,
        };
    }

    if (elapsed_ms >= target) {
        log.warn({
            msg: "time_budget_warning",
            request_id: requestId,
            elapsed_ms,
            target_ms: target,
        });
        return {
            allowed: true,
            reason: "time_budget_warning",
            elapsed_ms,
            limit: target,
        };
    }

    return { allowed: true, elapsed_ms, limit: target };
}

/**
 * Get appropriate fallback action when budget exceeded
 */
export function getBudgetExceededAction(budgetType: string): BudgetExceededAction {
    switch (budgetType) {
        case "moltbot_budget_exceeded":
            return {
                action: "fallback",
                message:
                    "We're having trouble processing your request automatically. A team member will review it shortly. Alternatively, you can call us directly.",
            };

        case "ocr_budget_exceeded":
            return {
                action: "fallback",
                message:
                    "We couldn't fully process the images you sent. Please try sending a clearer photo, or describe what you need in text.",
            };

        case "vendor_budget_exceeded":
            return {
                action: "handoff",
                options: ["Continue with current vendors", "Call support for more options"],
            };

        case "time_budget_exceeded":
            return {
                action: "handoff",
                options: [
                    "Call our hotline for immediate assistance",
                    "Wait for vendor responses (we'll send updates)",
                ],
            };

        default:
            return {
                action: "queue_human",
                reason: budgetType,
            };
    }
}

/**
 * Check all budgets at once
 */
export async function checkAllBudgets(requestId: string): Promise<{
    allAllowed: boolean;
    results: Record<string, BudgetCheckResult>;
    firstExceeded?: string;
}> {
    const [moltbot, ocr, vendor, time] = await Promise.all([
        checkMoltbotBudget(requestId),
        checkOcrBudget(requestId),
        checkVendorOutreachBudget(requestId),
        checkTimeToShortlistBudget(requestId),
    ]);

    const results = { moltbot, ocr, vendor, time };
    const firstExceeded = Object.entries(results).find(([, r]) => !r.allowed)?.[0];

    return {
        allAllowed: !firstExceeded,
        results,
        firstExceeded,
    };
}
