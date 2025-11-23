/**
 * Custom Error Classes
 * 
 * Provides structured error handling for webhook processing
 * Following GROUND_RULES.md: observability, error handling
 */

export class WebhookError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = "WEBHOOK_ERROR",
    isRetryable = false
  ) {
    super(message);
    this.name = "WebhookError";
    this.statusCode = statusCode;
    this.code = code;
    this.isRetryable = isRetryable;
    
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WebhookError);
    }
  }
}

export class ValidationError extends WebhookError {
  constructor(message: string, field?: string) {
    super(
      field ? `${message}: ${field}` : message,
      400,
      "VALIDATION_ERROR",
      false
    );
    this.name = "ValidationError";
  }
}

export class SignatureError extends WebhookError {
  constructor(message = "Invalid webhook signature") {
    super(message, 401, "SIGNATURE_ERROR", false);
    this.name = "SignatureError";
  }
}

export class RateLimitError extends WebhookError {
  public readonly retryAfter: number;

  constructor(message = "Rate limit exceeded", retryAfter = 60) {
    super(message, 429, "RATE_LIMIT_ERROR", true);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class ProcessingError extends WebhookError {
  constructor(message: string, isRetryable = true) {
    super(message, 500, "PROCESSING_ERROR", isRetryable);
    this.name = "ProcessingError";
  }
}

export class TimeoutError extends WebhookError {
  constructor(message = "Processing timeout", timeoutMs?: number) {
    super(
      timeoutMs ? `${message} after ${timeoutMs}ms` : message,
      504,
      "TIMEOUT_ERROR",
      true
    );
    this.name = "TimeoutError";
  }
}

export class CircuitBreakerOpenError extends WebhookError {
  constructor(message = "Circuit breaker is open") {
    super(message, 503, "CIRCUIT_BREAKER_OPEN", true);
    this.name = "CircuitBreakerOpenError";
  }
}
