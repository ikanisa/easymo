/**
 * Moltbot Output Validator
 *
 * Validates AI output against docs/moltbot/output-contract.v1.json
 *
 * @module moltbot/output-validator
 */

// ============================================================================
// Output Types (matching output-contract.v1.json)
// ============================================================================

export type RequestState =
    | "collecting_requirements"
    | "ocr_processing"
    | "vendor_outreach"
    | "awaiting_vendor_replies"
    | "shortlist_ready"
    | "handed_off"
    | "closed"
    | "error";

export interface AskClientOutput {
    type: "ask_client";
    question_text: string;
    why: string;
    options?: string[];
    state_suggestion?: RequestState;
}

export interface VendorOutreachPlanOutput {
    type: "vendor_outreach_plan";
    category: string;
    normalized_need: string;
    batch_size: number;
    vendor_questions: string[];
    stop_conditions: {
        max_vendors: number;
        min_replies?: number;
        timeout_hours?: number;
    };
    calling_allowed: boolean;
    vendor_filters?: {
        location_radius_km?: number;
        min_rating?: number;
        tags?: string[];
    };
}

export interface ShortlistItem {
    vendor_id: string;
    vendor_name: string;
    vendor_phone: string;
    response_summary: string;
    price?: number;
    availability?: string;
    metadata?: Record<string, unknown>;
}

export interface ShortlistOutput {
    type: "shortlist";
    summary_text: string;
    items: ShortlistItem[];
    handoff: {
        type: "wa_link" | "phone";
        message_template?: string;
    };
}

export interface EscalateOutput {
    type: "escalate";
    reason: string;
    safe_client_message: string;
    state_suggestion?: RequestState;
    to?: "human" | "fallback";
}

export type MoltbotOutput =
    | AskClientOutput
    | VendorOutreachPlanOutput
    | ShortlistOutput
    | EscalateOutput;

// ============================================================================
// Validation
// ============================================================================

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validate output against the Moltbot output contract
 */
export function validateOutputContract(output: unknown): ValidationResult {
    const errors: string[] = [];

    if (!output || typeof output !== "object") {
        return { valid: false, errors: ["Output must be a non-null object"] };
    }

    const obj = output as Record<string, unknown>;

    if (typeof obj.type !== "string") {
        return { valid: false, errors: ["Missing or invalid 'type' field"] };
    }

    switch (obj.type) {
        case "ask_client":
            return validateAskClient(obj);

        case "vendor_outreach_plan":
            return validateVendorOutreachPlan(obj);

        case "shortlist":
            return validateShortlist(obj);

        case "escalate":
            return validateEscalate(obj);

        default:
            return {
                valid: false,
                errors: [`Unknown type: ${obj.type}. Must be one of: ask_client, vendor_outreach_plan, shortlist, escalate`],
            };
    }
}

function validateAskClient(obj: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (typeof obj.question_text !== "string" || obj.question_text.length === 0) {
        errors.push("ask_client requires non-empty 'question_text' string");
    }

    if (typeof obj.why !== "string") {
        errors.push("ask_client requires 'why' string");
    }

    if (obj.options !== undefined && !Array.isArray(obj.options)) {
        errors.push("ask_client 'options' must be an array if provided");
    }

    if (obj.state_suggestion !== undefined && !isValidState(obj.state_suggestion)) {
        errors.push("ask_client 'state_suggestion' must be a valid state");
    }

    return { valid: errors.length === 0, errors };
}

function validateVendorOutreachPlan(obj: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (typeof obj.category !== "string" || obj.category.length === 0) {
        errors.push("vendor_outreach_plan requires non-empty 'category' string");
    }

    if (typeof obj.normalized_need !== "string") {
        errors.push("vendor_outreach_plan requires 'normalized_need' string");
    }

    if (typeof obj.batch_size !== "number" || obj.batch_size < 1 || obj.batch_size > 5) {
        errors.push("vendor_outreach_plan 'batch_size' must be 1-5");
    }

    if (!Array.isArray(obj.vendor_questions)) {
        errors.push("vendor_outreach_plan requires 'vendor_questions' array");
    }

    if (typeof obj.calling_allowed !== "boolean") {
        errors.push("vendor_outreach_plan requires 'calling_allowed' boolean");
    }

    // Validate stop_conditions
    if (!obj.stop_conditions || typeof obj.stop_conditions !== "object") {
        errors.push("vendor_outreach_plan requires 'stop_conditions' object");
    } else {
        const sc = obj.stop_conditions as Record<string, unknown>;
        if (typeof sc.max_vendors !== "number" || sc.max_vendors < 1 || sc.max_vendors > 15) {
            errors.push("stop_conditions.max_vendors must be 1-15");
        }
    }

    return { valid: errors.length === 0, errors };
}

function validateShortlist(obj: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (typeof obj.summary_text !== "string") {
        errors.push("shortlist requires 'summary_text' string");
    }

    if (!Array.isArray(obj.items)) {
        errors.push("shortlist requires 'items' array");
    } else {
        obj.items.forEach((item, i) => {
            if (typeof item !== "object" || !item) {
                errors.push(`shortlist item ${i} must be an object`);
                return;
            }
            const it = item as Record<string, unknown>;
            if (typeof it.vendor_id !== "string") errors.push(`item ${i} missing vendor_id`);
            if (typeof it.vendor_name !== "string") errors.push(`item ${i} missing vendor_name`);
            if (typeof it.vendor_phone !== "string") errors.push(`item ${i} missing vendor_phone`);
            if (typeof it.response_summary !== "string") errors.push(`item ${i} missing response_summary`);
        });
    }

    if (!obj.handoff || typeof obj.handoff !== "object") {
        errors.push("shortlist requires 'handoff' object");
    } else {
        const h = obj.handoff as Record<string, unknown>;
        if (h.type !== "wa_link" && h.type !== "phone") {
            errors.push("handoff.type must be 'wa_link' or 'phone'");
        }
    }

    return { valid: errors.length === 0, errors };
}

function validateEscalate(obj: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (typeof obj.reason !== "string" || obj.reason.length === 0) {
        errors.push("escalate requires non-empty 'reason' string");
    }

    if (typeof obj.safe_client_message !== "string") {
        errors.push("escalate requires 'safe_client_message' string");
    }

    if (obj.to !== undefined && obj.to !== "human" && obj.to !== "fallback") {
        errors.push("escalate 'to' must be 'human' or 'fallback'");
    }

    return { valid: errors.length === 0, errors };
}

function isValidState(state: unknown): state is RequestState {
    const validStates: RequestState[] = [
        "collecting_requirements",
        "ocr_processing",
        "vendor_outreach",
        "awaiting_vendor_replies",
        "shortlist_ready",
        "handed_off",
        "closed",
        "error",
    ];
    return typeof state === "string" && validStates.includes(state as RequestState);
}
