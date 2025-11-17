/**
 * API Error Classes
 * 
 * Standardized error types for better error handling and debugging.
 * Replaces generic 'any' error types with proper typed errors.
 */

// ============================================================================
// Base API Error
// ============================================================================

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// ============================================================================
// Specific Error Types
// ============================================================================

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = "Authentication required", details?: unknown) {
    super(message, 401, "AUTHENTICATION_ERROR", details);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = "Insufficient permissions", details?: unknown) {
    super(message, 403, "AUTHORIZATION_ERROR", details);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(message, 404, "NOT_FOUND", { resource, id });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "CONFLICT", details);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends ApiError {
  constructor(message = "Rate limit exceeded", retryAfter?: number) {
    super(message, 429, "RATE_LIMIT_EXCEEDED", { retryAfter });
    this.name = "RateLimitError";
  }
}

export class InternalServerError extends ApiError {
  constructor(message = "Internal server error", details?: unknown) {
    super(message, 500, "INTERNAL_SERVER_ERROR", details);
    this.name = "InternalServerError";
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(service: string, details?: unknown) {
    const extra =
      details && typeof details === "object" ? (details as Record<string, unknown>) : {};
    super(`Service ${service} is unavailable`, 503, "SERVICE_UNAVAILABLE", {
      service,
      ...extra,
    });
    this.name = "ServiceUnavailableError";
  }
}

// ============================================================================
// Error Factory
// ============================================================================

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message, {
      originalError: error.name,
      stack: error.stack,
    });
  }

  if (typeof error === "string") {
    return new InternalServerError(error);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return new InternalServerError((error as { message: string }).message);
  }

  return new InternalServerError("Unknown error occurred", { error });
}

// ============================================================================
// Error Response Helper
// ============================================================================

export function errorToResponse(error: unknown): Response {
  const apiError = normalizeError(error);

  return Response.json(apiError.toJSON(), {
    status: apiError.statusCode,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// ============================================================================
// Logging Helper
// ============================================================================

export function logError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const apiError = normalizeError(error);

  console.error("[API_ERROR]", {
    name: apiError.name,
    code: apiError.code,
    message: apiError.message,
    statusCode: apiError.statusCode,
    details: apiError.details,
    context,
    timestamp: new Date().toISOString(),
  });
}
