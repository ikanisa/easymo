/**
 * Internal Forward Security
 * 
 * Validates internal forward requests to prevent header spoofing.
 * Uses a shared secret token to verify requests are truly from wa-webhook-core.
 */

import { logStructuredEvent } from "../observability.ts";

const INTERNAL_FORWARD_SECRET = Deno.env.get("INTERNAL_FORWARD_SECRET") ?? 
  Deno.env.get("WA_INTERNAL_FORWARD_SECRET") ?? null;

/**
 * Generate a token for internal forward requests
 */
export function generateInternalForwardToken(): string | null {
  if (!INTERNAL_FORWARD_SECRET) {
    return null;
  }
  
  // Simple HMAC-based token (can be enhanced with timestamp/expiry)
  const timestamp = Date.now();
  const message = `internal-forward:${timestamp}`;
  
  // Use Web Crypto API for HMAC
  // Note: This is a simplified version - in production, use proper HMAC
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const key = encoder.encode(INTERNAL_FORWARD_SECRET);
  
  // For now, return a simple token (can be enhanced with crypto.subtle)
  return btoa(`${message}:${INTERNAL_FORWARD_SECRET.slice(0, 8)}`);
}

/**
 * Validate an internal forward token
 */
export function validateInternalForwardToken(token: string | null): boolean {
  if (!INTERNAL_FORWARD_SECRET) {
    // If no secret configured, allow (for development)
    logStructuredEvent("INTERNAL_FORWARD_NO_SECRET", {
      warning: "INTERNAL_FORWARD_SECRET not configured, allowing all internal forwards",
    }, "warn");
    return true;
  }
  
  if (!token) {
    return false;
  }
  
  try {
    // Decode and validate token
    const decoded = atob(token);
    const parts = decoded.split(":");
    
    if (parts.length < 2) {
      return false;
    }
    
    const message = parts.slice(0, -1).join(":");
    const secretPart = parts[parts.length - 1];
    
    // Validate secret part matches
    if (secretPart !== INTERNAL_FORWARD_SECRET.slice(0, 8)) {
      logStructuredEvent("INTERNAL_FORWARD_INVALID_TOKEN", {
        reason: "secret_mismatch",
      }, "warn");
      return false;
    }
    
    // Validate message format
    if (!message.startsWith("internal-forward:")) {
      logStructuredEvent("INTERNAL_FORWARD_INVALID_TOKEN", {
        reason: "invalid_format",
      }, "warn");
      return false;
    }
    
    // Optional: Check timestamp for expiry (e.g., 5 minutes)
    const timestamp = parseInt(message.split(":")[1]);
    if (isNaN(timestamp)) {
      return false;
    }
    
    const age = Date.now() - timestamp;
    const maxAge = 5 * 60 * 1000; // 5 minutes
    if (age > maxAge) {
      logStructuredEvent("INTERNAL_FORWARD_EXPIRED_TOKEN", {
        age,
        maxAge,
      }, "warn");
      return false;
    }
    
    return true;
  } catch {
    logStructuredEvent("INTERNAL_FORWARD_TOKEN_DECODE_ERROR", {}, "warn");
    return false;
  }
}

/**
 * Check if request is a valid internal forward
 */
export function isValidInternalForward(req: Request): boolean {
  const header = req.headers.get("x-wa-internal-forward");
  const token = req.headers.get("x-wa-internal-forward-token");
  
  if (header !== "true") {
    return false;
  }
  
  // Validate token if provided
  if (token) {
    return validateInternalForwardToken(token);
  }
  
  // If no token but header is set, log warning but allow (backward compatibility)
  // In production, this should be false
  const allowWithoutToken = (Deno.env.get("WA_ALLOW_INTERNAL_FORWARD") ?? "false").toLowerCase() === "true";
  if (!allowWithoutToken) {
    logStructuredEvent("INTERNAL_FORWARD_NO_TOKEN", {
      warning: "Internal forward header present but no token provided",
    }, "warn");
  }
  
  return allowWithoutToken;
}

