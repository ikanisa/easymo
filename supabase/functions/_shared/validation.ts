// Shared validation and rate limiting utilities
// Import Zod for schema validation
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ============================================================================
// INPUT VALIDATION
// ============================================================================

/**
 * Common validation schemas
 */
export const schemas = {
  // MSISDN validation (E.164 format)
  msisdn: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format"),
  
  // Token validation (alphanumeric, 4-100 chars)
  token: z.string().min(4).max(100).regex(/^[A-Za-z0-9:_-]+$/, "Invalid token format"),
  
  // UUID validation
  uuid: z.string().uuid("Invalid UUID format"),
  
  // Email validation
  email: z.string().email("Invalid email format"),
  
  // Pagination
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(20),
  
  // Coordinates
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
};

/**
 * Deeplink resolve request schema
 */
export const DeeplinkResolveSchema = z.object({
  token: schemas.token,
  msisdn: schemas.msisdn.optional(),
});

/**
 * Admin API request schema
 */
export const AdminRequestSchema = z.object({
  action: z.enum(["get", "update", "delete", "list"]),
  id: schemas.uuid.optional(),
  data: z.record(z.unknown()).optional(),
});

/**
 * User favorites schema
 */
export const FavoriteSchema = z.object({
  label: z.string().min(1).max(100),
  latitude: schemas.latitude,
  longitude: schemas.longitude,
  notes: z.string().max(500).optional(),
});

/**
 * Validate request body against schema
 * Returns parsed data or throws validation error
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Create validation error response
 */
export function validationErrorResponse(error: z.ZodError): Response {
  return new Response(
    JSON.stringify({
      error: "validation_failed",
      details: error.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    }),
    {
      status: 422,
      headers: { "Content-Type": "application/json" },
    }
  );
}

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit store (per-instance)
// For production, use Redis or Supabase for distributed rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if request exceeds rate limit
 * @param key - Unique identifier (IP, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns true if rate limit exceeded, false otherwise
 */
export function isRateLimited(
  key: string,
  config: RateLimitConfig
): { limited: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // No entry or window expired - allow and create new entry
  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      limited: false,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  // Increment count
  entry.count += 1;

  // Check if exceeded
  if (entry.count > config.maxRequests) {
    return {
      limited: true,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    limited: false,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Create rate limit error response
 */
export function rateLimitErrorResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({
      error: "rate_limit_exceeded",
      message: "Too many requests. Please try again later.",
      retry_after_seconds: retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": new Date(resetAt).toISOString(),
      },
    }
  );
}

/**
 * Cleanup expired rate limit entries (run periodically)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

/**
 * Extract IP address from request
 */
export function getClientIP(req: Request): string {
  // Check common headers for IP (behind proxy)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  
  // Fallback (may not be available in all environments)
  return "unknown";
}

/**
 * Extract user identifier from request (for user-based rate limiting)
 */
export function getUserIdentifier(req: Request): string | null {
  // Check for user ID in custom header
  const userId = req.headers.get("x-user-id");
  if (userId) {
    return userId;
  }
  
  // Check for auth token and extract user ID (simplified)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    // In production, validate JWT and extract user ID
    return "authenticated";
  }
  
  return null;
}

// ============================================================================
// COMMON RESPONSES
// ============================================================================

export function successResponse(data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(
  message: string,
  status = 400,
  code?: string
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: code || "error",
      message,
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export function notFoundResponse(resource = "Resource"): Response {
  return errorResponse(`${resource} not found`, 404, "not_found");
}

export function unauthorizedResponse(message = "Unauthorized"): Response {
  return errorResponse(message, 401, "unauthorized");
}

export function forbiddenResponse(message = "Forbidden"): Response {
  return errorResponse(message, 403, "forbidden");
}

export function serverErrorResponse(
  message = "Internal server error"
): Response {
  return errorResponse(message, 500, "internal_error");
}
