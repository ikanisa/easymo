/**
 * Error Classification and Handling Utilities
 * Provides structured error types with appropriate HTTP status codes
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        details: this.details,
      },
    };
  }
}

/**
 * 400 Bad Request - Client sent invalid data
 */
export class BadRequestError extends AppError {
  constructor(message: string, code = "BAD_REQUEST", details?: Record<string, unknown>) {
    super(message, 400, code, details);
    this.name = "BadRequestError";
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", code = "UNAUTHORIZED") {
    super(message, 401, code);
    this.name = "UnauthorizedError";
  }
}

/**
 * 403 Forbidden - User lacks permission
 */
export class ForbiddenError extends AppError {
  constructor(message = "Access forbidden", code = "FORBIDDEN") {
    super(message, 403, code);
    this.name = "ForbiddenError";
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string, code = "NOT_FOUND") {
    super(`${resource} not found`, 404, code);
    this.name = "NotFoundError";
  }
}

/**
 * 409 Conflict - Resource state conflict
 */
export class ConflictError extends AppError {
  constructor(message: string, code = "CONFLICT", details?: Record<string, unknown>) {
    super(message, 409, code, details);
    this.name = "ConflictError";
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message = "Too many requests", retryAfter?: number) {
    super(message, 429, "RATE_LIMIT_EXCEEDED", { retryAfter });
    this.name = "RateLimitError";
  }
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
export class InternalError extends AppError {
  constructor(message = "Internal server error", code = "INTERNAL_ERROR") {
    super(message, 500, code);
    this.name = "InternalError";
  }
}

/**
 * 503 Service Unavailable - External service down
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, code = "SERVICE_UNAVAILABLE") {
    super(`${service} is currently unavailable`, 503, code);
    this.name = "ServiceUnavailableError";
  }
}

/**
 * Error handler middleware
 * Converts errors to appropriate HTTP responses
 */
export function handleError(error: unknown): Response {
  // Handle known AppError types
  if (error instanceof AppError) {
    return new Response(JSON.stringify(error.toJSON()), {
      status: error.statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Handle validation errors
  if (error instanceof Error && error.name === "ValidationError") {
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
          code: "VALIDATION_ERROR",
        },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Handle Supabase errors
  if (error && typeof error === "object" && "code" in error) {
    const pgError = error as { code: string; message: string };

    // Concurrent update (optimistic locking)
    if (pgError.code === "PGRST116") {
      return new Response(
        JSON.stringify({
          error: {
            message: "Resource was modified by another request. Please retry.",
            code: "CONCURRENT_UPDATE",
          },
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Unique constraint violation
    if (pgError.code === "23505") {
      return new Response(
        JSON.stringify({
          error: {
            message: "Resource already exists",
            code: "DUPLICATE_RESOURCE",
          },
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Foreign key violation
    if (pgError.code === "23503") {
      return new Response(
        JSON.stringify({
          error: {
            message: "Referenced resource not found",
            code: "INVALID_REFERENCE",
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // Unknown error - log and return generic 500
  console.error("Unhandled error:", error);

  return new Response(
    JSON.stringify({
      error: {
        message: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
      },
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    },
  );
}

/**
 * Wrap async handler with error handling
 */
export function withErrorHandling(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (error) {
      return handleError(error);
    }
  };
}
