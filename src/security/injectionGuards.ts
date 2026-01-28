/**
 * Prompt Injection Containment
 *
 * Functions to detect, contain, and block prompt injection attacks
 * and dangerous AI outputs in the Moltbot concierge system.
 */

// =============================================================================
// Types
// =============================================================================

export interface VendorOutreachPlan {
    vendor_ids: string[];
    batch_size: number;
    max_vendors?: number;
    max_batches?: number;
    message_template?: string;
}

export interface MoltbotOutput {
    type: string;
    message?: string;
    vendor_outreach_plan?: VendorOutreachPlan;
    [key: string]: unknown;
}

export interface InjectionDetectionResult {
    detected: boolean;
    patterns: string[];
    severity: 'low' | 'medium' | 'high';
    sanitized?: string;
}

export interface ForbiddenIntentResult {
    blocked: boolean;
    reason?: string;
    intent?: string;
}

// =============================================================================
// Injection Pattern Detection
// =============================================================================

/**
 * Patterns that indicate potential prompt injection attempts.
 * Ordered by severity (high to low).
 */
const INJECTION_PATTERNS: Array<{
    pattern: RegExp;
    name: string;
    severity: 'low' | 'medium' | 'high';
}> = [
        // High severity: Direct instruction override attempts
        {
            pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|prompts?)/i,
            name: 'ignore_instructions',
            severity: 'high',
        },
        {
            pattern: /ignore\s+(your\s+)?(limits?|rules?|restrictions?|boundaries)/i,
            name: 'ignore_limits',
            severity: 'high',
        },
        {
            pattern: /you\s+are\s+now\s+[a-z]+/i,
            name: 'role_override',
            severity: 'high',
        },
        {
            pattern: /system\s*:\s*|<\s*system\s*>/i,
            name: 'system_tag_injection',
            severity: 'high',
        },
        {
            pattern: /\[\s*INST\s*\]|\[\s*\/INST\s*\]/i,
            name: 'instruction_tags',
            severity: 'high',
        },
        {
            pattern: /disregard\s+(your\s+)?(safety|guidelines|rules)/i,
            name: 'safety_override',
            severity: 'high',
        },


        // Medium severity: Indirect manipulation
        {
            pattern: /pretend\s+(you\s+)?(are|to\s+be)/i,
            name: 'pretend_command',
            severity: 'medium',
        },
        {
            pattern: /act\s+as\s+(if|a)\s+/i,
            name: 'act_as_command',
            severity: 'medium',
        },
        {
            pattern: /do\s+not\s+follow\s+(your\s+)?(rules?|guidelines?|instructions?)/i,
            name: 'rule_negation',
            severity: 'medium',
        },
        {
            pattern: /output\s+(everything|all|the)\s+(you\s+)?know/i,
            name: 'data_exfiltration',
            severity: 'medium',
        },
        {
            pattern: /reveal\s+(your|the)\s+(system|prompt|instructions?)/i,
            name: 'prompt_reveal',
            severity: 'medium',
        },

        // Low severity: Suspicious but may be legitimate
        {
            pattern: /message\s+all\s+vendors?/i,
            name: 'mass_outreach_request',
            severity: 'low',
        },
        {
            pattern: /contact\s+every(one|body|\s+vendor)/i,
            name: 'mass_contact_request',
            severity: 'low',
        },
        {
            pattern: /send\s+to\s+all/i,
            name: 'broadcast_request',
            severity: 'low',
        },
    ];

/**
 * Detect injection patterns in text input.
 *
 * @param text - Input text to analyze
 * @returns Detection result with matched patterns and severity
 */
export function detectInjectionPatterns(text: string): InjectionDetectionResult {
    if (!text || typeof text !== 'string') {
        return { detected: false, patterns: [], severity: 'low' };
    }

    const matchedPatterns: string[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' = 'low';

    for (const { pattern, name, severity } of INJECTION_PATTERNS) {
        if (pattern.test(text)) {
            matchedPatterns.push(name);

            // Track highest severity
            if (severity === 'high') {
                maxSeverity = 'high';
            } else if (severity === 'medium' && maxSeverity !== 'high') {
                maxSeverity = 'medium';
            }
        }
    }

    return {
        detected: matchedPatterns.length > 0,
        patterns: matchedPatterns,
        severity: maxSeverity,
    };
}

// =============================================================================
// Tool Output Caps
// =============================================================================

/** Hard limits for vendor outreach plans */
const TOOL_CAPS = {
    MAX_VENDORS: 15,
    MAX_BATCH_SIZE: 5,
    MAX_BATCHES: 3,
} as const;

/**
 * Enforce hard limits on vendor outreach plans.
 * Clamps values to safe maximums.
 *
 * @param plan - Original vendor outreach plan
 * @returns Clamped plan with safe limits
 */
export function enforceToolCaps(plan: VendorOutreachPlan): VendorOutreachPlan {
    if (!plan) {
        return plan;
    }

    return {
        ...plan,
        vendor_ids: plan.vendor_ids?.slice(0, TOOL_CAPS.MAX_VENDORS) ?? [],
        batch_size: Math.min(Math.max(plan.batch_size ?? 1, 1), TOOL_CAPS.MAX_BATCH_SIZE),
        max_vendors: Math.min(plan.max_vendors ?? TOOL_CAPS.MAX_VENDORS, TOOL_CAPS.MAX_VENDORS),
        max_batches: Math.min(plan.max_batches ?? TOOL_CAPS.MAX_BATCHES, TOOL_CAPS.MAX_BATCHES),
    };
}

/**
 * Check if a plan was clamped (values were reduced).
 *
 * @param original - Original plan
 * @param clamped - Clamped plan
 * @returns true if any values were reduced
 */
export function wasPlanClamped(
    original: VendorOutreachPlan,
    clamped: VendorOutreachPlan
): boolean {
    return (
        (original.vendor_ids?.length ?? 0) > (clamped.vendor_ids?.length ?? 0) ||
        (original.batch_size ?? 0) > (clamped.batch_size ?? 0) ||
        (original.max_vendors ?? 0) > (clamped.max_vendors ?? 0) ||
        (original.max_batches ?? 0) > (clamped.max_batches ?? 0)
    );
}

// =============================================================================
// Forbidden Intent Blocking
// =============================================================================

/**
 * Forbidden intents that should trigger immediate fallback.
 */
const FORBIDDEN_INTENTS: Array<{
    pattern: RegExp;
    intent: string;
    reason: string;
}> = [
        // Payment/financial manipulation
        {
            pattern: /pay\s+(a\s+)?deposit/i,
            intent: 'payment_redirect',
            reason: 'Attempted payment redirection',
        },
        {
            pattern: /send\s+(money|payment|cash|funds)/i,
            intent: 'payment_request',
            reason: 'Attempted payment request',
        },
        {
            pattern: /transfer\s+to\s+(this\s+)?(account|number|wallet)/i,
            intent: 'payment_diversion',
            reason: 'Attempted payment diversion',
        },

        // Data exfiltration
        {
            pattern: /share\s+(all\s+)?(customer|client|user)\s+(data|info|details)/i,
            intent: 'data_exfiltration',
            reason: 'Attempted data exfiltration',
        },
        {
            pattern: /list\s+all\s+(phone|contact|number)/i,
            intent: 'contact_enumeration',
            reason: 'Attempted contact enumeration',
        },

        // System abuse
        {
            pattern: /bypass\s+(the\s+)?(limit|quota|restriction)/i,
            intent: 'limit_bypass',
            reason: 'Attempted limit bypass',
        },
        {
            pattern: /disable\s+(safety|security|verification)/i,
            intent: 'safety_disable',
            reason: 'Attempted safety disable',
        },

        // Spam/harassment
        {
            pattern: /spam\s+(all|every|the)\s+vendor/i,
            intent: 'vendor_spam',
            reason: 'Attempted vendor spam',
        },
        {
            pattern: /harass|threaten|abuse/i,
            intent: 'harassment',
            reason: 'Harassment intent detected',
        },
    ];

/**
 * Check Moltbot output for forbidden intents.
 *
 * @param output - Moltbot output to analyze
 * @returns Block result with reason if blocked
 */
export function blockForbiddenIntents(output: MoltbotOutput): ForbiddenIntentResult {
    if (!output) {
        return { blocked: false };
    }

    // Check message content
    const message = output.message ?? '';
    const template = output.vendor_outreach_plan?.message_template ?? '';
    const textToCheck = `${message} ${template}`;

    for (const { pattern, intent, reason } of FORBIDDEN_INTENTS) {
        if (pattern.test(textToCheck)) {
            return {
                blocked: true,
                intent,
                reason,
            };
        }
    }

    return { blocked: false };
}

// =============================================================================
// Combined Validation
// =============================================================================

export interface ValidationResult {
    valid: boolean;
    injectionDetected: boolean;
    intentBlocked: boolean;
    planClamped: boolean;
    details: {
        injection?: InjectionDetectionResult;
        forbiddenIntent?: ForbiddenIntentResult;
        originalPlan?: VendorOutreachPlan;
        clampedPlan?: VendorOutreachPlan;
    };
}

/**
 * Validate and sanitize a complete Moltbot interaction.
 *
 * @param input - User input text
 * @param output - Moltbot output
 * @returns Validation result with all checks
 */
export function validateMoltbotInteraction(
    input: string,
    output: MoltbotOutput
): ValidationResult {
    const result: ValidationResult = {
        valid: true,
        injectionDetected: false,
        intentBlocked: false,
        planClamped: false,
        details: {},
    };

    // Check input for injection
    const injectionResult = detectInjectionPatterns(input);
    if (injectionResult.detected) {
        result.injectionDetected = true;
        result.details.injection = injectionResult;

        // High severity = invalid
        if (injectionResult.severity === 'high') {
            result.valid = false;
        }
    }

    // Check output for forbidden intents
    const intentResult = blockForbiddenIntents(output);
    if (intentResult.blocked) {
        result.valid = false;
        result.intentBlocked = true;
        result.details.forbiddenIntent = intentResult;
    }

    // Check and clamp vendor outreach plan
    if (output.vendor_outreach_plan) {
        const original = output.vendor_outreach_plan;
        const clamped = enforceToolCaps(original);

        if (wasPlanClamped(original, clamped)) {
            result.planClamped = true;
            result.details.originalPlan = original;
            result.details.clampedPlan = clamped;
        }
    }

    return result;
}
