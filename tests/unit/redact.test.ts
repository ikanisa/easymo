/**
 * Unit tests for PII redaction utilities
 */

import { describe, it, expect } from "vitest";
import {
    maskPhone,
    cleanPhone,
    redactContent,
    redactRawPayload,
    safeLog,
    hashForLog,
} from "../../src/security/redact";

describe("redact utilities", () => {
    describe("maskPhone", () => {
        it("should mask phone showing only last 3 digits", () => {
            expect(maskPhone("+250788123456")).toBe("***456");
            expect(maskPhone("0788123456")).toBe("***456");
            expect(maskPhone("+1-555-123-4567")).toBe("***567");
        });

        it("should handle short phones", () => {
            expect(maskPhone("123")).toBe("***");
            expect(maskPhone("12")).toBe("***");
            expect(maskPhone("")).toBe("***");
        });

        it("should handle null/undefined", () => {
            expect(maskPhone(null)).toBe("***");
            expect(maskPhone(undefined)).toBe("***");
        });
    });

    describe("cleanPhone", () => {
        it("should remove non-digits except leading +", () => {
            expect(cleanPhone("+250 788 123 456")).toBe("+250788123456");
            expect(cleanPhone("+1-555-123-4567")).toBe("+15551234567");
            expect(cleanPhone("(555) 123-4567")).toBe("5551234567");
        });

        it("should preserve leading +", () => {
            expect(cleanPhone("+250788123456")).toBe("+250788123456");
        });
    });

    describe("redactContent", () => {
        it("should mask phone numbers", () => {
            expect(redactContent("Call me at +250788123456")).toBe("Call me at [PHONE]");
            expect(redactContent("Phone: 0788123456789")).toBe("Phone: [PHONE]");
        });

        it("should mask emails", () => {
            expect(redactContent("Email: test@example.com")).toBe("Email: [EMAIL]");
            expect(redactContent("Contact john.doe@company.org")).toBe("Contact [EMAIL]");
        });

        it("should mask credit cards", () => {
            expect(redactContent("Card: 1234 5678 9012 3456")).toBe("Card: [CARD]");
            expect(redactContent("Card: 1234-5678-9012-3456")).toBe("Card: [CARD]");
        });

        it("should truncate when specified", () => {
            const longText = "This is a very long message that should be truncated";
            const result = redactContent(longText, { truncate: 20 });
            expect(result).toBe("This is a very long ...");
        });

        it("should handle null/undefined", () => {
            expect(redactContent(null)).toBeNull();
            expect(redactContent(undefined)).toBeNull();
        });

        it("should handle multiple PII patterns", () => {
            const input = "Contact me at +250788123456 or email@test.com";
            expect(redactContent(input)).toBe("Contact me at [PHONE] or [EMAIL]");
        });
    });

    describe("redactRawPayload", () => {
        it("should redact phone fields", () => {
            const payload = { name: "John", phone: "+250788123456" };
            const result = redactRawPayload(payload);
            expect(result.phone).toBe("***456");
            expect(result.name).toBe("John");
        });

        it("should redact email fields", () => {
            const payload = { email: "test@example.com" };
            const result = redactRawPayload(payload);
            expect(result.email).toBe("[EMAIL]");
        });

        it("should redact secret fields", () => {
            const payload = { token: "secret123", password: "hunter2" };
            const result = redactRawPayload(payload);
            expect(result.token).toBe("[REDACTED]");
            expect(result.password).toBe("[REDACTED]");
        });

        it("should handle nested objects", () => {
            const payload = {
                user: {
                    name: "John",
                    client_phone: "+250788123456",
                },
            };
            const result = redactRawPayload(payload);
            expect(result.user.client_phone).toBe("***456");
            expect(result.user.name).toBe("John");
        });

        it("should handle arrays", () => {
            const payload = {
                contacts: [
                    { phone: "+250788111111" },
                    { phone: "+250788222222" },
                ],
            };
            const result = redactRawPayload(payload);
            expect(result.contacts[0].phone).toBe("***111");
            expect(result.contacts[1].phone).toBe("***222");
        });

        it("should scan string values for embedded PII", () => {
            const payload = { message: "Call +250788123456 for info" };
            const result = redactRawPayload(payload);
            expect(result.message).toBe("Call [PHONE] for info");
        });

        it("should handle api_key variations", () => {
            const payload = { api_key: "sk-12345", apikey: "pk-67890" };
            const result = redactRawPayload(payload);
            expect(result.api_key).toBe("[REDACTED]");
            expect(result.apikey).toBe("[REDACTED]");
        });
    });

    describe("safeLog", () => {
        it("should be an alias for redactRawPayload", () => {
            const payload = { phone: "+250788123456" };
            expect(safeLog(payload)).toEqual(redactRawPayload(payload));
        });
    });

    describe("hashForLog", () => {
        it("should return 12-character hash", () => {
            const result = hashForLog("test-vendor-id");
            expect(result).toHaveLength(12);
            expect(result).toMatch(/^[a-f0-9]+$/);
        });

        it("should be deterministic", () => {
            const hash1 = hashForLog("same-value");
            const hash2 = hashForLog("same-value");
            expect(hash1).toBe(hash2);
        });

        it("should produce different hashes for different inputs", () => {
            const hash1 = hashForLog("value-1");
            const hash2 = hashForLog("value-2");
            expect(hash1).not.toBe(hash2);
        });
    });
});
