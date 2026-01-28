/**
 * Moltbot E2E Test Suite
 *
 * Workflow 12, Phase E: Golden scenarios for full conversation flow
 *
 * @module __tests__/integration/moltbot-e2e
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { validateOutputContract } from "../../_shared/moltbot/output-validator.ts";
import { codedWorkflows, type MoltbotContextPack } from "../../_shared/moltbot/coded-workflows.ts";

// ============================================================================
// Test Fixtures
// ============================================================================

function createBaseContext(overrides?: Partial<MoltbotContextPack>): MoltbotContextPack {
    return {
        conversation: {
            id: "conv_test_001",
            clientPhone: "+250780000001",
            language: "en",
            recentMessages: [],
        },
        request: null,
        ...overrides,
    };
}

// ============================================================================
// Output Contract Validation Tests
// ============================================================================

Deno.test("Output Validator - ask_client valid", () => {
    const output = {
        type: "ask_client",
        question_text: "What do you need?",
        why: "Need to understand requirements",
    };

    const result = validateOutputContract(output);
    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
});

Deno.test("Output Validator - ask_client with options valid", () => {
    const output = {
        type: "ask_client",
        question_text: "What category?",
        why: "Need category",
        options: ["Medicine", "Electronics", "Other"],
    };

    const result = validateOutputContract(output);
    assertEquals(result.valid, true);
});

Deno.test("Output Validator - ask_client missing question_text invalid", () => {
    const output = {
        type: "ask_client",
        why: "Need to understand",
    };

    const result = validateOutputContract(output);
    assertEquals(result.valid, false);
    assertEquals(result.errors.length > 0, true);
});

Deno.test("Output Validator - vendor_outreach_plan valid", () => {
    const output = {
        type: "vendor_outreach_plan",
        category: "pharmacy",
        normalized_need: "Paracetamol 500mg",
        batch_size: 5,
        vendor_questions: ["1. Do you have this?", "2. Price?"],
        stop_conditions: {
            max_vendors: 15,
            min_replies: 3,
        },
        calling_allowed: false,
    };

    const result = validateOutputContract(output);
    assertEquals(result.valid, true);
});

Deno.test("Output Validator - vendor_outreach_plan batch_size > 5 invalid", () => {
    const output = {
        type: "vendor_outreach_plan",
        category: "pharmacy",
        normalized_need: "Test",
        batch_size: 10, // Invalid: > 5
        vendor_questions: [],
        stop_conditions: { max_vendors: 15 },
        calling_allowed: false,
    };

    const result = validateOutputContract(output);
    assertEquals(result.valid, false);
    assertEquals(result.errors.some((e) => e.includes("batch_size")), true);
});

Deno.test("Output Validator - shortlist valid", () => {
    const output = {
        type: "shortlist",
        summary_text: "Found 2 options:",
        items: [
            {
                vendor_id: "v1",
                vendor_name: "Pharmacy A",
                vendor_phone: "+250780000002",
                response_summary: "In stock, 500 RWF",
            },
        ],
        handoff: { type: "wa_link" },
    };

    const result = validateOutputContract(output);
    assertEquals(result.valid, true);
});

Deno.test("Output Validator - escalate valid", () => {
    const output = {
        type: "escalate",
        reason: "Cannot understand request",
        safe_client_message: "Let me connect you with support.",
        to: "human",
    };

    const result = validateOutputContract(output);
    assertEquals(result.valid, true);
});

Deno.test("Output Validator - unknown type invalid", () => {
    const output = {
        type: "unknown_action",
        data: "test",
    };

    const result = validateOutputContract(output);
    assertEquals(result.valid, false);
});

// ============================================================================
// Coded Workflows Tests
// ============================================================================

Deno.test("Coded Workflow - collectRequirements asks for category", () => {
    const context = createBaseContext({
        conversation: {
            id: "conv_001",
            clientPhone: "+250780000001",
            language: "en",
            recentMessages: [{ role: "client", text: "Hi, I need something", timestamp: new Date().toISOString() }],
        },
        request: {
            id: "req_001",
            conversation_id: "conv_001",
            state: "collecting_requirements",
            requirements: {},
            shortlist: [],
            error_reason: null,
        },
    });

    const result = codedWorkflows.collectRequirements(context);

    assertEquals(result.type, "ask_client");
    assertExists(result.question_text);
});

Deno.test("Coded Workflow - collectRequirements with category asks for item", () => {
    const context = createBaseContext({
        request: {
            id: "req_002",
            conversation_id: "conv_001",
            state: "collecting_requirements",
            requirements: { category: "pharmacy" },
            shortlist: [],
            error_reason: null,
        },
    });

    const result = codedWorkflows.collectRequirements(context);

    assertEquals(result.type, "ask_client");
    assertEquals(result.question_text.includes("pharmacy"), true);
});

Deno.test("Coded Workflow - collectRequirements complete triggers vendor outreach", () => {
    const context = createBaseContext({
        request: {
            id: "req_003",
            conversation_id: "conv_001",
            state: "collecting_requirements",
            requirements: {
                category: "pharmacy",
                item_description: "Paracetamol 500mg",
            },
            shortlist: [],
            error_reason: null,
        },
    });

    const result = codedWorkflows.collectRequirements(context);

    assertEquals(result.type, "vendor_outreach_plan");
    assertEquals((result as { category: string }).category, "pharmacy");
});

Deno.test("Coded Workflow - processOcrResult low confidence asks for confirmation", () => {
    const context = createBaseContext({
        ocrData: {
            extracted: { item: "Paracetamol", quantity: 20 },
            confidence: 0.6, // Below 0.75 threshold
        },
    });

    const result = codedWorkflows.processOcrResult(context);

    assertEquals(result.type, "ask_client");
    assertEquals(result.question_text.includes("correct"), true);
});

Deno.test("Coded Workflow - processOcrResult high confidence triggers outreach", () => {
    const context = createBaseContext({
        request: {
            id: "req_004",
            conversation_id: "conv_001",
            state: "ocr_processing",
            requirements: { category: "pharmacy" },
            shortlist: [],
            error_reason: null,
        },
        ocrData: {
            extracted: { item: "Ibuprofen 400mg", quantity: 10 },
            confidence: 0.9,
        },
    });

    const result = codedWorkflows.processOcrResult(context);

    assertEquals(result.type, "vendor_outreach_plan");
});

Deno.test("Coded Workflow - generateShortlist creates valid shortlist", () => {
    const context = createBaseContext({
        vendorReplies: [
            {
                vendorId: "v1",
                vendorName: "Pharmacy Plus",
                vendorPhone: "+250780000010",
                responseText: "Yes, in stock. Price is 500 RWF.",
                responseData: {},
            },
            {
                vendorId: "v2",
                vendorName: "Health Mart",
                vendorPhone: "+250780000011",
                responseText: "Available, 600 RWF",
                responseData: {},
            },
        ],
    });

    const result = codedWorkflows.generateShortlist(context);

    assertEquals(result.type, "shortlist");
    assertEquals((result as { items: unknown[] }).items.length, 2);
});

Deno.test("Coded Workflow - generateShortlist no replies escalates", () => {
    const context = createBaseContext({
        vendorReplies: [],
    });

    const result = codedWorkflows.generateShortlist(context);

    assertEquals(result.type, "escalate");
});

Deno.test("Coded Workflow - extractPrice parses various formats", () => {
    assertEquals(codedWorkflows.extractPrice("Price: 500 RWF"), 500);
    assertEquals(codedWorkflows.extractPrice("RWF 1,500"), 1500);
    assertEquals(codedWorkflows.extractPrice("Available for 2000"), 2000);
    assertEquals(codedWorkflows.extractPrice("No price mentioned"), undefined);
});

// ============================================================================
// Golden Scenario Tests
// ============================================================================

Deno.test("Golden Scenario 1 - New conversation asks for category", () => {
    const context = createBaseContext({
        conversation: {
            id: "conv_golden_1",
            clientPhone: "+250780000100",
            language: "en",
            recentMessages: [
                { role: "client", text: "Hello", timestamp: new Date().toISOString() },
            ],
        },
    });

    const result = codedWorkflows.collectRequirements(context);

    assertEquals(result.type, "ask_client");
    assertExists(result.options);
});

Deno.test("Golden Scenario 2 - Complete requirements triggers outreach", () => {
    const context = createBaseContext({
        request: {
            id: "req_golden_2",
            conversation_id: "conv_golden_2",
            state: "collecting_requirements",
            requirements: {
                category: "electronics",
                item_description: "iPhone charger USB-C",
            },
            shortlist: [],
            error_reason: null,
        },
    });

    const result = codedWorkflows.collectRequirements(context);

    assertEquals(result.type, "vendor_outreach_plan");

    // Validate the plan
    const validation = validateOutputContract(result);
    assertEquals(validation.valid, true);
});

Deno.test("Golden Scenario 3 - Vendor replies generate shortlist", () => {
    const context = createBaseContext({
        request: {
            id: "req_golden_3",
            conversation_id: "conv_golden_3",
            state: "awaiting_vendor_replies",
            requirements: { category: "electronics", item_description: "iPhone charger" },
            shortlist: [],
            error_reason: null,
        },
        vendorReplies: [
            {
                vendorId: "v10",
                vendorName: "Tech Store",
                vendorPhone: "+250780000200",
                responseText: "Yes available, 5000 RWF",
                responseData: {},
            },
            {
                vendorId: "v11",
                vendorName: "Mobile World",
                vendorPhone: "+250780000201",
                responseText: "In stock! 4500 RWF delivery included",
                responseData: {},
            },
        ],
    });

    const result = codedWorkflows.handleVendorOutreach(context);

    assertEquals(result.type, "shortlist");

    // Validate shortlist
    const validation = validateOutputContract(result);
    assertEquals(validation.valid, true);

    // Check items are sorted by price
    const items = (result as { items: Array<{ price?: number }> }).items;
    assertEquals(items[0].price, 4500); // Cheaper first
    assertEquals(items[1].price, 5000);
});

console.log("✅ Moltbot E2E Test Suite Ready");
