import { createHmac } from "crypto";

// Import only the signature module without triggering config loading
import { verifyWebhookSignature } from "../src/signature";

describe("verifyWebhookSignature", () => {
  const testSecret = "test-app-secret-123";
  const testPayload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "123" }],
  });

  /**
   * Helper to generate valid HMAC-SHA256 signature
   */
  function generateSignature(payload: string, secret: string): string {
    const hash = createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex");
    return `sha256=${hash}`;
  }

  describe("valid signatures", () => {
    it("should return true for valid signature", () => {
      const signature = generateSignature(testPayload, testSecret);
      const result = verifyWebhookSignature(testPayload, signature, testSecret);
      expect(result).toBe(true);
    });

    it("should return true for signature with different payloads", () => {
      const payload1 = '{"test": 1}';
      const payload2 = '{"test": 2}';

      const sig1 = generateSignature(payload1, testSecret);
      const sig2 = generateSignature(payload2, testSecret);

      expect(verifyWebhookSignature(payload1, sig1, testSecret)).toBe(true);
      expect(verifyWebhookSignature(payload2, sig2, testSecret)).toBe(true);
      // Cross-check: wrong signature for wrong payload
      expect(verifyWebhookSignature(payload1, sig2, testSecret)).toBe(false);
    });
  });

  describe("invalid signatures", () => {
    it("should return false for null signature", () => {
      const result = verifyWebhookSignature(testPayload, null, testSecret);
      expect(result).toBe(false);
    });

    it("should return false for empty signature", () => {
      const result = verifyWebhookSignature(testPayload, "", testSecret);
      expect(result).toBe(false);
    });

    it("should return false for signature without sha256= prefix", () => {
      const hash = createHmac("sha256", testSecret)
        .update(testPayload)
        .digest("hex");
      const result = verifyWebhookSignature(testPayload, hash, testSecret);
      expect(result).toBe(false);
    });

    it("should return false for signature with wrong prefix", () => {
      const hash = createHmac("sha256", testSecret)
        .update(testPayload)
        .digest("hex");
      const result = verifyWebhookSignature(testPayload, `md5=${hash}`, testSecret);
      expect(result).toBe(false);
    });

    it("should return false for tampered payload", () => {
      const signature = generateSignature(testPayload, testSecret);
      const tamperedPayload = testPayload + "tampered";
      const result = verifyWebhookSignature(tamperedPayload, signature, testSecret);
      expect(result).toBe(false);
    });

    it("should return false for wrong secret", () => {
      const signature = generateSignature(testPayload, testSecret);
      const result = verifyWebhookSignature(testPayload, signature, "wrong-secret");
      expect(result).toBe(false);
    });

    it("should return false for malformed hex signature", () => {
      const result = verifyWebhookSignature(testPayload, "sha256=not-valid-hex", testSecret);
      expect(result).toBe(false);
    });
  });

  describe("missing configuration", () => {
    it("should return false for empty secret", () => {
      const signature = generateSignature(testPayload, testSecret);
      const result = verifyWebhookSignature(testPayload, signature, "");
      expect(result).toBe(false);
    });
  });

  describe("timing-safe comparison", () => {
    it("should handle signatures of different lengths", () => {
      // Short signature should fail
      const result = verifyWebhookSignature(testPayload, "sha256=abc", testSecret);
      expect(result).toBe(false);
    });

    it("should handle very long signatures gracefully", () => {
      const longSignature = "sha256=" + "a".repeat(1000);
      const result = verifyWebhookSignature(testPayload, longSignature, testSecret);
      expect(result).toBe(false);
    });
  });
});
