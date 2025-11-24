/**
 * Enhanced Webhook Verification with Security Features
 * Provides signature verification, caching, and timing-safe comparison
 */

import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { logStructuredEvent } from "../observe/log.ts";

interface VerificationCache {
  valid: boolean;
  timestamp: number;
}

export class WebhookVerifier {
  private appSecret: string;
  private validationToken: string;
  private verificationCache: Map<string, VerificationCache>;
  private readonly CACHE_TTL = 60000; // 1 minute

  constructor(appSecret: string, validationToken: string) {
    this.appSecret = appSecret;
    this.validationToken = validationToken;
    this.verificationCache = new Map();

    // Cleanup cache periodically
    setInterval(() => this.cleanupCache(), this.CACHE_TTL);
  }

  /**
   * Verify WhatsApp webhook signature with caching
   */
  verifySignature(
    payload: string,
    signature: string | null,
    correlationId: string
  ): boolean {
    if (!this.appSecret) {
      logStructuredEvent("WEBHOOK_VERIFICATION_DISABLED", { correlationId });
      return true; // Skip verification if not configured
    }

    if (!signature) {
      logStructuredEvent("MISSING_SIGNATURE", { correlationId });
      return false;
    }

    // Check cache
    const cacheKey = `${signature}:${this.hashPayload(payload)}`;
    const cached = this.verificationCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logStructuredEvent("SIGNATURE_CACHE_HIT", { correlationId });
      return cached.valid;
    }

    try {
      // Extract signature parts
      const signatureParts = signature.split("=");
      if (signatureParts.length !== 2 || signatureParts[0] !== "sha256") {
        logStructuredEvent("INVALID_SIGNATURE_FORMAT", {
          signature: signature.substring(0, 20) + "...",
          correlationId,
        });
        return false;
      }

      const receivedSignature = signatureParts[1];

      // Calculate expected signature
      const expectedSignature = createHmac("sha256", this.appSecret)
        .update(payload)
        .digest("hex");

      // Timing-safe comparison
      const isValid = this.timingSafeEqual(receivedSignature, expectedSignature);

      // Cache result
      this.verificationCache.set(cacheKey, {
        valid: isValid,
        timestamp: Date.now(),
      });

      if (!isValid) {
        logStructuredEvent("SIGNATURE_MISMATCH", {
          correlationId,
          receivedLength: receivedSignature.length,
          expectedLength: expectedSignature.length,
        });
      } else {
        logStructuredEvent("SIGNATURE_VALID", { correlationId });
      }

      return isValid;
    } catch (error) {
      logStructuredEvent("SIGNATURE_VERIFICATION_ERROR", {
        error: error.message,
        correlationId,
      });
      return false;
    }
  }

  /**
   * Handle WhatsApp verification challenge
   */
  handleVerificationChallenge(
    mode: string | null,
    token: string | null,
    challenge: string | null
  ): Response | null {
    if (mode === "subscribe") {
      if (token === this.validationToken) {
        logStructuredEvent("VERIFICATION_CHALLENGE_SUCCESS", {
          challenge: challenge?.substring(0, 10) + "...",
        });
        return new Response(challenge, { status: 200 });
      }

      logStructuredEvent("VERIFICATION_CHALLENGE_FAILED", {
        providedToken: token?.substring(0, 10) + "...",
      });
      return new Response("Forbidden", { status: 403 });
    }

    return null;
  }

  /**
   * Timing-safe string comparison
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Hash payload for cache key
   */
  private hashPayload(payload: string): string {
    return createHmac("sha256", "cache-key")
      .update(payload)
      .digest("hex")
      .substring(0, 16);
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.verificationCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.verificationCache.delete(key);
      }
    }
  }

  /**
   * Get verification statistics
   */
  getStats(): { cacheSize: number; cacheHitRate: number } {
    return {
      cacheSize: this.verificationCache.size,
      cacheHitRate: 0, // Would need tracking for actual rate
    };
  }
}
