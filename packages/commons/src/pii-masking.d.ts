/**
 * PII (Personally Identifiable Information) Masking Utilities
 *
 * Ensures sensitive data is not exposed in logs, metrics, or error messages.
 * Required by GROUND_RULES.md for all logging operations.
 */
/**
 * Mask phone number, showing only country code and last 2 digits
 * Examples:
 *   +254712345678 → +254*****78
 *   254712345678  → 254*****78
 *   0712345678    → 0712***78
 */
export declare function maskPhone(phone: string): string;
/**
 * Mask email address, showing only first 2 chars and domain
 * Examples:
 *   john.doe@example.com → jo****@example.com
 *   a@test.co            → a*@test.co
 */
export declare function maskEmail(email: string): string;
/**
 * Mask national ID / passport number
 * Shows only first 2 and last 2 characters
 * Examples:
 *   1234567890123 → 12*********23
 *   A12345678     → A1*****78
 */
export declare function maskIdNumber(id: string): string;
/**
 * Mask credit card number (PCI compliance)
 * Shows only last 4 digits
 * Examples:
 *   4532123456781234 → ************1234
 *   4532-1234-5678-1234 → ************1234
 */
export declare function maskCardNumber(card: string): string;
/**
 * Mask address, keeping only city and country
 * Examples:
 *   { street: "123 Main St", city: "Kigali", country: "Rwanda" }
 *     → { street: "***", city: "Kigali", country: "Rwanda" }
 */
export declare function maskAddress(address: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
}): {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
};
/**
 * Mask an object containing PII fields
 * Automatically detects and masks common PII fields
 */
export declare function maskPII<T extends Record<string, any>>(obj: T): T;
/**
 * Safe logger wrapper that automatically masks PII
 * Use this instead of console.log for production
 */
export declare function logSafely(level: "info" | "warn" | "error", message: string, data?: any): void;
//# sourceMappingURL=pii-masking.d.ts.map