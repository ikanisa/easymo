/**
 * Custom Error Classes
 * 
 * Provides structured error handling for webhook processing
 * Following GROUND_RULES.md: observability, error handling
 */

export class WebhookError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "WebhookError";
    
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WebhookError);
    }
  }
}

export class ValidationError extends WebhookError {
  details?: any;
  
  constructor(message: string, details?: any) {
    super(message, "VALIDATION_ERROR", false, 400);
    this.name = "ValidationError";
    if (details) {
      this.details = details;
    }
  }
}

export class SignatureError extends WebhookError {
  constructor(message = "Invalid webhook signature") {
    super(message, "SIGNATURE_ERROR", false, 401);
    this.name = "SignatureError";
  }
}

export class AuthenticationError extends WebhookError {
  constructor(message: string) {
    super(message, "AUTHENTICATION_ERROR", false, 401);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends WebhookError {
  retryAfter: number;

  constructor(message: string, retryAfter: number = 60) {
    super(message, "RATE_LIMIT_ERROR", true, 429);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class ProcessingError extends WebhookError {
  constructor(message: string, retryable: boolean = true) {
    super(message, "PROCESSING_ERROR", retryable, 500);
    this.name = "ProcessingError";
  }
}

export class ExternalServiceError extends WebhookError {
  service: string;

  constructor(service: string, message: string) {
    super(`${service}: ${message}`, "EXTERNAL_SERVICE_ERROR", true, 502);
    this.name = "ExternalServiceError";
    this.service = service;
  }
}

export class TimeoutError extends WebhookError {
  constructor(message = "Processing timeout", timeoutMs?: number) {
    super(
      timeoutMs ? `${message} after ${timeoutMs}ms` : message,
      "TIMEOUT_ERROR",
      true,
      504
    );
    this.name = "TimeoutError";
  }
}

export class CircuitBreakerOpenError extends WebhookError {
  constructor(message = "Circuit breaker is open") {
    super(message, "CIRCUIT_BREAKER_OPEN", true, 503);
    this.name = "CircuitBreakerOpenError";
  }
}

// ============================================
// ERROR HANDLER MIDDLEWARE
// ============================================

/**
 * Error handler middleware for webhook processing
 * Converts errors to proper HTTP responses with structured error objects
 */
export async function errorHandler(
  func: () => Promise<Response>,
  logger: any
): Promise<Response> {
  try {
    return await func();
  } catch (error) {
    if (error instanceof Error) {
      logger.error("Unhandled error", {
        error: error.message,
        stack: error.stack,
        name: error.name
      });
    } else {
      logger.error("Unhandled error", {
        error: String(error)
      });
    }

    if (error instanceof WebhookError) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Error-Code": error.code
      };

      if (error instanceof RateLimitError) {
        headers["Retry-After"] = String(error.retryAfter);
      }

      return new Response(
        JSON.stringify({
          error: {
            message: error.message,
            code: error.code,
            retryable: error.retryable
          }
        }),
        {
          status: error.statusCode,
          headers
        }
      );
    }

    // Generic error response for unknown errors
    return new Response(
      JSON.stringify({
        error: {
          message: "Internal Server Error",
          code: "INTERNAL_ERROR"
        }
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
}