import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify WhatsApp webhook signature using HMAC-SHA256
 * 
 * Per docs/GROUND_RULES.md - ALL webhook endpoints MUST verify signatures
 * 
 * @param payload - Raw webhook payload as string
 * @param signature - Signature from x-hub-signature-256 header
 * @param appSecret - WhatsApp app secret
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature) {
    return false;
  }

  if (!appSecret) {
    return false;
  }

  try {
    // Parse signature format: sha256=<hex>
    const [method, receivedHash] = signature.split("=");
    if (method !== "sha256" || !receivedHash) {
      return false;
    }

    // Compute expected signature
    const expectedHash = createHmac("sha256", appSecret)
      .update(payload, "utf8")
      .digest("hex");

    // Use timing-safe comparison to prevent timing attacks
    const receivedBuffer = Buffer.from(receivedHash, "hex");
    const expectedBuffer = Buffer.from(expectedHash, "hex");

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

