/**
 * Enhanced Signature Verification Module
 * Provides HMAC-SHA256 signature verification for WhatsApp webhooks
 */

import { logStructuredEvent } from "../observability.ts";

// ============================================================================
// TYPES
// ============================================================================

export type SignatureVerificationResult = {
  valid: boolean;
  method: "sha256" | "sha1" | null;
  reason: 
    | "valid"
    | "invalid_signature"
    | "missing_signature"
    | "missing_secret"
    | "bypass_allowed"
    | "internal_forward"
    | "verification_error";
  details?: Record<string, unknown>;
};

export type SignatureConfig = {
  /** Require valid signature (default: true) */
  required: boolean;
  /** Allow unsigned requests for development (default: false) */
  allowUnsigned: boolean;
  /** Allow internal service forwarding (default: false) */
  allowInternalForward: boolean;
  /** App secret for verification */
  appSecret: string | null;
};

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify WhatsApp webhook signature
 */
export async function verifySignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const [method, hash] = signature.split("=", 2);
  
  if (!hash) {
    return false;
  }

  const algorithm = method === "sha256" ? "SHA-256" : "SHA-1";
  const encoder = new TextEncoder();
  
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody)
  );

  const computedHash = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Timing-safe comparison
  return timingSafeEqual(computedHash, hash);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
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
 * Extract signature metadata for logging
 */
export function extractSignatureMetadata(req: Request): {
  provided: boolean;
  header: string | null;
  method: string | null;
  sample: string | null;
} {
  const signatureHeader = req.headers.has("x-hub-signature-256")
    ? "x-hub-signature-256"
    : req.headers.has("x-hub-signature")
    ? "x-hub-signature"
    : null;

  const signature = signatureHeader ? req.headers.get(signatureHeader) : null;

  if (!signature) {
    return {
      provided: false,
      header: null,
      method: null,
      sample: null,
    };
  }

  const [method, hash] = signature.split("=", 2);
  return {
    provided: true,
    header: signatureHeader,
    method: method?.toLowerCase() ?? null,
    sample: hash ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : null,
  };
}

/**
 * Full signature verification with configuration
 */
export async function verifyWebhookRequest(
  req: Request,
  rawBody: string,
  serviceName: string,
  config?: Partial<SignatureConfig>
): Promise<SignatureVerificationResult> {
  const fullConfig: SignatureConfig = {
    required: config?.required ?? true,
    allowUnsigned: config?.allowUnsigned ?? 
      (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true",
    allowInternalForward: config?.allowInternalForward ?? 
      (Deno.env.get("WA_ALLOW_INTERNAL_FORWARD") ?? "false").toLowerCase() === "true",
    appSecret: config?.appSecret ?? 
      Deno.env.get("WHATSAPP_APP_SECRET") ?? 
      Deno.env.get("WA_APP_SECRET") ?? null,
  };

  const meta = extractSignatureMetadata(req);
  const isInternalForward = req.headers.get("x-wa-internal-forward") === "true";

  // Check if secret is configured
  if (!fullConfig.appSecret) {
    logStructuredEvent(`${serviceName.toUpperCase()}_AUTH_CONFIG_ERROR`, {
      service: serviceName,
      reason: "missing_app_secret",
    }, "error");

    return {
      valid: false,
      method: null,
      reason: "missing_secret",
      details: { message: "WHATSAPP_APP_SECRET not configured" },
    };
  }

  // Check for internal forward bypass
  if (isInternalForward && fullConfig.allowInternalForward) {
    logStructuredEvent(`${serviceName.toUpperCase()}_AUTH_BYPASS`, {
      service: serviceName,
      reason: "internal_forward",
      ...meta,
    }, "warn");

    return {
      valid: true,
      method: null,
      reason: "internal_forward",
    };
  }

  // Check if signature is provided
  if (!meta.provided) {
    if (fullConfig.allowUnsigned) {
      logStructuredEvent(`${serviceName.toUpperCase()}_AUTH_BYPASS`, {
        service: serviceName,
        reason: "no_signature_allowed",
      }, "warn");

      return {
        valid: true,
        method: null,
        reason: "bypass_allowed",
      };
    }

    logStructuredEvent(`${serviceName.toUpperCase()}_AUTH_FAILED`, {
      service: serviceName,
      reason: "missing_signature",
      ...meta,
    }, "warn");

    return {
      valid: false,
      method: null,
      reason: "missing_signature",
    };
  }

  // Verify the signature
  try {
    const signature = req.headers.get(meta.header!)!;
    const isValid = await verifySignature(rawBody, signature, fullConfig.appSecret);

    if (isValid) {
      logStructuredEvent(`${serviceName.toUpperCase()}_SIGNATURE_VALID`, {
        service: serviceName,
        ...meta,
      }, "debug");

      return {
        valid: true,
        method: meta.method as "sha256" | "sha1",
        reason: "valid",
      };
    }

    // Invalid signature
    if (fullConfig.allowUnsigned) {
      logStructuredEvent(`${serviceName.toUpperCase()}_AUTH_BYPASS`, {
        service: serviceName,
        reason: "signature_mismatch_allowed",
        ...meta,
      }, "warn");

      return {
        valid: true,
        method: meta.method as "sha256" | "sha1",
        reason: "bypass_allowed",
      };
    }

    logStructuredEvent(`${serviceName.toUpperCase()}_AUTH_FAILED`, {
      service: serviceName,
      reason: "invalid_signature",
      ...meta,
    }, "warn");

    return {
      valid: false,
      method: meta.method as "sha256" | "sha1",
      reason: "invalid_signature",
    };

  } catch (error) {
    logStructuredEvent(`${serviceName.toUpperCase()}_SIGNATURE_ERROR`, {
      service: serviceName,
      error: error instanceof Error ? error.message : String(error),
      ...meta,
    }, "error");

    return {
      valid: false,
      method: meta.method as "sha256" | "sha1",
      reason: "verification_error",
      details: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}
