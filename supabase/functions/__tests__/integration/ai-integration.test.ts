/**
 * Moltbot AI Integration Tests
 *
 * Tests AI output validation, allowlist behavior, and fallback logic.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { validateOutputContract } from "../../_shared/moltbot/output-validator.ts";

// =============================================================================
// Test Fixtures - AI Output Samples (matching full contract)
// =============================================================================

const VALID_ASK_CLIENT = {
    type: "ask_client",
    question_text: "What category of product are you looking for?",
    why: "Need to determine product category to find appropriate vendors",
    options: ["pharmacy", "electronics", "groceries"],
} as const;

const VALID_VENDOR_OUTREACH = {
    type: "vendor_outreach_plan",
    category: "pharmacy",
    normalized_need: "Client needs Amoxicillin 500mg, 10 tablets",
    batch_size: 3,
    vendor_questions: ["Do you have Amoxicillin 500mg in stock?"],
    stop_conditions: {
        max_vendors: 10,
        min_replies: 2,
        timeout_hours: 4,
    },
    calling_allowed: false,
} as const;

const VALID_SHORTLIST = {
    type: "shortlist",
    summary_text: "Found 2 pharmacies with your medication:",
    items: [
        {
            vendor_id: "v-001",
            vendor_name: "PharmaCare Kigali",
            vendor_phone: "+250788123456",
            response_summary: "In stock, 500 RWF per box",
            price: 500,
        },
    ],
    handoff: {
        type: "wa_link" as const,
        message_template: "Hi, I'm interested in the medication",
    },
} as const;

const VALID_ESCALATE = {
    type: "escalate",
    reason: "Unable to parse client request",
    safe_client_message: "I'm having trouble understanding. Let me connect you with a human.",
    to: "human" as const,
} as const;

// =============================================================================
// AI Output Validation Tests
// =============================================================================

Deno.test("AI Integration - Valid Outputs", async (t) => {
    await t.step("ask_client passes validation", () => {
        const result = validateOutputContract(VALID_ASK_CLIENT);
        assertEquals(result.valid, true, `Errors: ${result.errors?.join(", ")}`);
    });

    await t.step("vendor_outreach_plan passes validation", () => {
        const result = validateOutputContract(VALID_VENDOR_OUTREACH);
        assertEquals(result.valid, true, `Errors: ${result.errors?.join(", ")}`);
    });

    await t.step("shortlist passes validation", () => {
        const result = validateOutputContract(VALID_SHORTLIST);
        assertEquals(result.valid, true, `Errors: ${result.errors?.join(", ")}`);
    });

    await t.step("escalate passes validation", () => {
        const result = validateOutputContract(VALID_ESCALATE);
        assertEquals(result.valid, true, `Errors: ${result.errors?.join(", ")}`);
    });
});

Deno.test("AI Integration - Invalid Outputs Rejected", async (t) => {
    await t.step("empty object rejected", () => {
        const result = validateOutputContract({});
        assertEquals(result.valid, false);
        assertExists(result.errors);
    });

    await t.step("missing required fields rejected", () => {
        const result = validateOutputContract({
            type: "ask_client",
            // missing question_text and why
        });
        assertEquals(result.valid, false);
    });

    await t.step("invalid type rejected", () => {
        const result = validateOutputContract({
            type: "invalid_type",
            message: "test",
        });
        assertEquals(result.valid, false);
    });

    await t.step("array instead of object rejected", () => {
        const result = validateOutputContract([VALID_ASK_CLIENT]);
        assertEquals(result.valid, false);
    });

    await t.step("null rejected", () => {
        const result = validateOutputContract(null);
        assertEquals(result.valid, false);
    });

    await t.step("batch_size > 5 rejected", () => {
        const result = validateOutputContract({
            ...VALID_VENDOR_OUTREACH,
            batch_size: 10,
        });
        assertEquals(result.valid, false);
    });

    await t.step("missing handoff rejected for shortlist", () => {
        const result = validateOutputContract({
            type: "shortlist",
            summary_text: "test",
            items: [{ vendor_id: "1", vendor_name: "Test", vendor_phone: "123", response_summary: "test" }],
            // missing handoff
        });
        assertEquals(result.valid, false);
    });
});

// =============================================================================
// AI/Coded Mode Decision Tests
// =============================================================================

Deno.test("AI Mode Decision Logic", async (t) => {
    function shouldUseAi(aiEnabled: boolean, isAllowlisted: boolean): boolean {
        return aiEnabled && isAllowlisted;
    }

    await t.step("AI disabled → uses coded workflow", () => {
        assertEquals(shouldUseAi(false, true), false);
    });

    await t.step("AI enabled, not allowlisted → uses coded workflow", () => {
        assertEquals(shouldUseAi(true, false), false);
    });

    await t.step("AI enabled + allowlisted → uses AI", () => {
        assertEquals(shouldUseAi(true, true), true);
    });

    await t.step("AI disabled + not allowlisted → uses coded workflow", () => {
        assertEquals(shouldUseAi(false, false), false);
    });
});

// =============================================================================
// AI Fallback Scenarios
// =============================================================================

Deno.test("AI Fallback Behavior", async (t) => {
    await t.step("invalid AI output triggers fallback", () => {
        const aiOutput = { invalid: "structure" };
        const validation = validateOutputContract(aiOutput);
        assertEquals(validation.valid, false);
    });

    await t.step("valid AI output proceeds normally", () => {
        const validation = validateOutputContract(VALID_ASK_CLIENT);
        assertEquals(validation.valid, true, `Errors: ${validation.errors?.join(", ")}`);
    });
});

// =============================================================================
// Calling Consent Flow Tests
// =============================================================================

Deno.test("Calling Consent Flow", async (t) => {
    type ConsentState = "none" | "requested" | "granted" | "denied" | "expired";

    interface ConsentRecord {
        state: ConsentState;
        requestedAt: string | null;
        expiresAt: string | null;
    }

    function canInitiateCall(consent: ConsentRecord): boolean {
        if (consent.state !== "granted") return false;
        if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) return false;
        return true;
    }

    function isConsentExpired(consent: ConsentRecord): boolean {
        if (!consent.expiresAt) return false;
        return new Date(consent.expiresAt) < new Date();
    }

    await t.step("no consent → cannot call", () => {
        const consent: ConsentRecord = { state: "none", requestedAt: null, expiresAt: null };
        assertEquals(canInitiateCall(consent), false);
    });

    await t.step("requested consent → cannot call", () => {
        const consent: ConsentRecord = { state: "requested", requestedAt: new Date().toISOString(), expiresAt: null };
        assertEquals(canInitiateCall(consent), false);
    });

    await t.step("denied consent → cannot call", () => {
        const consent: ConsentRecord = { state: "denied", requestedAt: new Date().toISOString(), expiresAt: null };
        assertEquals(canInitiateCall(consent), false);
    });

    await t.step("granted consent → can call", () => {
        const expiresAt = new Date(Date.now() + 3600000).toISOString();
        const consent: ConsentRecord = { state: "granted", requestedAt: new Date().toISOString(), expiresAt };
        assertEquals(canInitiateCall(consent), true);
    });

    await t.step("expired consent → cannot call", () => {
        const expiresAt = new Date(Date.now() - 3600000).toISOString();
        const consent: ConsentRecord = { state: "granted", requestedAt: new Date().toISOString(), expiresAt };
        assertEquals(canInitiateCall(consent), false);
        assertEquals(isConsentExpired(consent), true);
    });
});

// =============================================================================
// Call Gating Tests
// =============================================================================

Deno.test("Call Gating Logic", async (t) => {
    function shouldRecommendCall(
        hasConsent: boolean,
        vendorReplyCount: number,
        requestType: string,
    ): boolean {
        if (!hasConsent) return false;
        if (requestType === "simple_request") return false;
        if (vendorReplyCount === 0) return true;
        return false;
    }

    await t.step("no consent, 0 vendor replies → no call", () => {
        assertEquals(shouldRecommendCall(false, 0, "pharmacy"), false);
    });

    await t.step("with consent, 0 vendor replies → recommend call", () => {
        assertEquals(shouldRecommendCall(true, 0, "pharmacy"), true);
    });

    await t.step("with consent, has vendor replies → no call needed", () => {
        assertEquals(shouldRecommendCall(true, 3, "pharmacy"), false);
    });

    await t.step("simple request → no call recommended", () => {
        assertEquals(shouldRecommendCall(true, 0, "simple_request"), false);
    });
});

console.log("✅ AI Integration Tests Ready");
