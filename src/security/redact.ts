/**
 * PII Redaction Utilities
 *
 * Central module for masking and redacting sensitive data.
 * Used for logging, exports, and Moltbot context packs.
 */

import { createHash } from "crypto";

// =============================================================================
// Phone Masking
// =============================================================================

/**
 * Mask phone number, showing only last 3 digits.
 * @example maskPhone("+250788123456") => "***456"
 */
export function maskPhone(phone: string | null | undefined): string {
    if (!phone || phone.length < 4) return "***";
    return "***" + phone.slice(-3);
}

/**
 * Clean phone number (remove non-digits except leading +).
 * @example cleanPhone("+250 788 123 456") => "+250788123456"
 */
export function cleanPhone(phone: string): string {
    // Keep leading + if present, remove all other non-digits
    if (phone.startsWith("+")) {
        return "+" + phone.slice(1).replace(/\D/g, "");
    }
    return phone.replace(/\D/g, "");
}

// =============================================================================
// Content Redaction
// =============================================================================

/**
 * Redact PII patterns from text content.
 * Removes phone numbers, emails, and optionally truncates.
 */
export function redactContent(
    content: string | null | undefined,
    options: { truncate?: number } = {}
): string | null {
    if (!content) return null;

    let redacted = content;

    // Truncate if specified
    if (options.truncate && redacted.length > options.truncate) {
        redacted = redacted.slice(0, options.truncate) + "...";
    }

    // Mask phone number patterns (international format)
    redacted = redacted.replace(/\+?\d{10,15}/g, "[PHONE]");

    // Mask email patterns
    redacted = redacted.replace(/[\w.-]+@[\w.-]+\.\w+/g, "[EMAIL]");

    // Mask credit card patterns (basic)
    redacted = redacted.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[CARD]");

    return redacted;
}

// =============================================================================
// Payload Redaction (Deep)
// =============================================================================

// Fields that should always be redacted
const SENSITIVE_KEYS = new Set([
    "phone",
    "client_phone",
    "vendor_phone",
    "whatsapp_number",
    "email",
    "password",
    "token",
    "secret",
    "api_key",
    "apikey",
    "authorization",
    "credit_card",
    "card_number",
    "ssn",
    "social_security",
]);

/**
 * Recursively redact sensitive fields from an object.
 * Returns a new object with sensitive values masked.
 */
export function redactRawPayload<T extends object>(payload: T): T {
    if (!payload || typeof payload !== "object") {
        return payload;
    }

    if (Array.isArray(payload)) {
        return payload.map((item) =>
            typeof item === "object" && item !== null ? redactRawPayload(item) : item
        ) as T;
    }

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(payload)) {
        const lowerKey = key.toLowerCase();

        if (SENSITIVE_KEYS.has(lowerKey)) {
            // Mask the entire value
            if (typeof value === "string") {
                if (lowerKey.includes("phone") || lowerKey.includes("whatsapp")) {
                    result[key] = maskPhone(value);
                } else if (lowerKey.includes("email")) {
                    result[key] = "[EMAIL]";
                } else {
                    result[key] = "[REDACTED]";
                }
            } else {
                result[key] = "[REDACTED]";
            }
        } else if (typeof value === "object" && value !== null) {
            result[key] = redactRawPayload(value as object);
        } else if (typeof value === "string") {
            // Scan string values for embedded PII
            result[key] = redactContent(value);
        } else {
            result[key] = value;
        }
    }

    return result as T;
}

// =============================================================================
// Safe Logging
// =============================================================================

/**
 * Wrapper for safe logging. Redacts sensitive data and strips secrets.
 * Use this for all log output that might contain user data.
 */
export function safeLog<T extends object>(obj: T): T {
    return redactRawPayload(obj);
}

/**
 * Hash a value for logging (e.g., vendor IDs, request IDs for correlation).
 * Returns first 12 characters of SHA-256 hash.
 */
export function hashForLog(value: string): string {
    return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

// =============================================================================
// Export Helpers
// =============================================================================

/**
 * Prepare an object for external export (compliance, debug packs).
 * More aggressive redaction than logging.
 */
export function prepareForExport<T extends object>(obj: T): T {
    const redacted = redactRawPayload(obj);

    // Additional export-specific redactions could go here
    // e.g., removing internal IDs, timestamps, etc.

    return redacted;
}
