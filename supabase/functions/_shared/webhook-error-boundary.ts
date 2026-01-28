/**
 * Webhook Error Boundary Module
 * 
 * Comprehensive error handling for all webhook services with:
 * - Standardized error responses
 * - User-friendly messages
 * - Automatic retry logic
 * - Circuit breaker integration
 * - DLQ support
 * 
 * @see IMPLEMENTATION_PHASES.md Phase 2.1
 */

import { storeDLQEntry } from "./dlq-manager.ts";
import {
  AuthenticationError,
  CircuitBreakerOpenError,
  ExternalServiceError,
  ProcessingError,
  RateLimitError,
  SignatureError,
  TimeoutError,
  ValidationError,
  WebhookError,
} from "./errors.ts";
import { logStructuredEvent, recordMetric } from "./observability.ts";
import { maskPhone } from "./phone-utils.ts";

/**
 * Context for webhook error handling
 */
export interface WebhookErrorContext {
  service: string;
  correlationId: string;
  requestId: string;
  phoneNumber?: string;
  messageId?: string;
  payload?: Record<string, unknown>;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Error recovery options
 */
export interface ErrorRecoveryOptions {
  enableDLQ?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  userFriendlyMessages?: boolean;
  notifyUser?: boolean;
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    retryable: boolean;
    userMessage?: string;
    retryAfter?: number;
  };
  correlationId: string;
  timestamp: string;
}

/**
 * Map error types to user-friendly messages
 */
const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "Sorry, the message format was invalid. Please try again.",
  SIGNATURE_ERROR: "Authentication failed. Please contact support.",
  AUTHENTICATION_ERROR: "Authentication failed. Please contact support.",
  RATE_LIMIT_ERROR: "Too many requests. Please wait a moment and try again.",
  PROCESSING_ERROR: "We're experiencing technical difficulties. Please try again shortly.",
  EXTERNAL_SERVICE_ERROR: "A service is temporarily unavailable. We'll retry automatically.",
  TIMEOUT_ERROR: "Request timed out. We'll retry automatically.",
  CIRCUIT_BREAKER_OPEN: "Service temporarily unavailable. Please try again in a moment.",
  INTERNAL_ERROR: "An unexpected error occurred. Our team has been notified.",
};

/**
 * Wrap a webhook handler with comprehensive error boundary
 * 
 * @param handler - The webhook handler function
 * @param context - Error context information
 * @param options - Recovery options
 * @returns Wrapped handler with error boundary
 * 
 * @example
 * ```typescript
 * serve(withWebhookErrorBoundary(
 *   async (req) => {
 *     // Your webhook logic
 *     return new Response("OK", { status: 200 });
 *   },
 *   {
 *     service: "wa-webhook-jobs",
 *     correlationId: crypto.randomUUID(),
 *     requestId: crypto.randomUUID(),
 *   },
 *   {
 *     enableDLQ: true,
 *     enableRetry: true,
 *     userFriendlyMessages: true,
 *   }
 * ));
 * ```
 */
export function withWebhookErrorBoundary(
  handler: (req: Request) => Promise<Response>,
  getContext: (req: Request) => WebhookErrorContext,
  options: ErrorRecoveryOptions = {}
): (req: Request) => Promise<Response> {
  const {
    enableDLQ = true,
    enableRetry = true,
    maxRetries = 3,
    userFriendlyMessages = true,
    notifyUser = false,
  } = options;

  return async (req: Request): Promise<Response> => {
    const startTime = performance.now();
    let context: WebhookErrorContext | null = null;

    try {
      // Get context (may throw if request is malformed)
      context = getContext(req);

      // Execute the handler
      const response = await handler(req);

      // Log successful execution
      const duration = performance.now() - startTime;
      logStructuredEvent("WEBHOOK_SUCCESS", {
        service: context.service,
        correlationId: context.correlationId,
        duration: Math.round(duration),
        status: response.status,
      });

      recordMetric(`${context.service}.success`, 1, {
        status: response.status.toString(),
      });

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Use fallback context if getContext failed
      if (!context) {
        context = {
          service: "unknown",
          correlationId: req.headers.get("x-correlation-id") || crypto.randomUUID(),
          requestId: req.headers.get("x-request-id") || crypto.randomUUID(),
        };
      }

      // Handle the error and create appropriate response
      return await handleWebhookError(
        error,
        context,
        {
          enableDLQ,
          enableRetry,
          maxRetries,
          userFriendlyMessages,
          notifyUser,
        },
        duration
      );
    }
  };
}

/**
 * Handle webhook errors with recovery mechanisms
 */
async function handleWebhookError(
  error: unknown,
  context: WebhookErrorContext,
  options: ErrorRecoveryOptions,
  duration: number
): Promise<Response> {
  const {
    enableDLQ,
    enableRetry,
    maxRetries,
    userFriendlyMessages,
  } = options;

  // Determine error details
  const errorDetails = extractErrorDetails(error);
  const shouldRetry = errorDetails.retryable && enableRetry;

  // Log the error
  logStructuredEvent("WEBHOOK_ERROR", {
    service: context.service,
    correlationId: context.correlationId,
    requestId: context.requestId,
    errorCode: errorDetails.code,
    errorMessage: errorDetails.message,
    retryable: errorDetails.retryable,
    statusCode: errorDetails.statusCode,
    duration: Math.round(duration),
    phone: context.phoneNumber ? maskPhone(context.phoneNumber) : undefined,
    messageId: context.messageId,
  }, "error");

  // Record metric
  recordMetric(`${context.service}.error`, 1, {
    errorCode: errorDetails.code,
    retryable: errorDetails.retryable.toString(),
  });

  // Store in DLQ if enabled and retryable
  if (enableDLQ && shouldRetry && context.payload) {
    await storeDLQEntry({
      service: context.service,
      payload: context.payload,
      error: errorDetails.message,
      correlationId: context.correlationId,
      whatsappMessageId: context.messageId,
      maxRetries: maxRetries || 3,
    });

    logStructuredEvent("WEBHOOK_DLQ_STORED", {
      service: context.service,
      correlationId: context.correlationId,
      errorCode: errorDetails.code,
    });
  }

  // Create error response
  const errorResponse: ErrorResponse = {
    error: {
      message: errorDetails.message,
      code: errorDetails.code,
      retryable: errorDetails.retryable,
    },
    correlationId: context.correlationId,
    timestamp: new Date().toISOString(),
  };

  // Add user-friendly message if enabled
  if (userFriendlyMessages) {
    errorResponse.error.userMessage = getUserFriendlyMessage(errorDetails.code);
  }

  // Add retry-after for rate limit errors
  if (error instanceof RateLimitError) {
    errorResponse.error.retryAfter = error.retryAfter;
  }

  // Create HTTP headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Correlation-ID": context.correlationId,
    "X-Request-ID": context.requestId,
    "X-Error-Code": errorDetails.code,
  };

  // Add Retry-After header for rate limits
  if (error instanceof RateLimitError) {
    headers["Retry-After"] = error.retryAfter.toString();
  }

  // Add standard rate limit headers if available
  if (errorDetails.statusCode === 429) {
    headers["X-RateLimit-Limit"] = "30"; // Default, should be dynamic
    headers["X-RateLimit-Remaining"] = "0";
    headers["X-RateLimit-Reset"] = new Date(Date.now() + 60000).toISOString();
  }

  return new Response(
    JSON.stringify(errorResponse, null, 2),
    {
      status: errorDetails.statusCode,
      headers,
    }
  );
}

/**
 * Extract error details from various error types
 */
function extractErrorDetails(error: unknown): {
  message: string;
  code: string;
  retryable: boolean;
  statusCode: number;
} {
  // Handle WebhookError and its subclasses
  if (error instanceof WebhookError) {
    return {
      message: error.message,
      code: error.code,
      retryable: error.retryable,
      statusCode: error.statusCode,
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Check for common retryable patterns
    const message = error.message.toLowerCase();
    const isRetryable = (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("429") ||
      message.includes("503") ||
      message.includes("504")
    );

    return {
      message: error.message,
      code: "INTERNAL_ERROR",
      retryable: isRetryable,
      statusCode: 500,
    };
  }

  // Handle unknown error types
  return {
    message: String(error),
    code: "UNKNOWN_ERROR",
    retryable: false,
    statusCode: 500,
  };
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(errorCode: string): string {
  return USER_FRIENDLY_MESSAGES[errorCode] || USER_FRIENDLY_MESSAGES.INTERNAL_ERROR;
}

/**
 * Create a safe async operation wrapper with timeout
 * 
 * @param operation - The operation to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Name for logging
 * @returns Result of the operation
 * 
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   () => externalApiCall(),
 *   5000,
 *   "external_api"
 * );
 * ```
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError(`${operationName} timed out`, timeoutMs)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Validate webhook payload with structured errors
 * 
 * @param payload - The payload to validate
 * @param schema - Validation schema
 * @throws ValidationError if validation fails
 */
export function validatePayload<T>(
  payload: unknown,
  validator: (payload: unknown) => payload is T,
  errorMessage: string = "Invalid payload structure"
): asserts payload is T {
  if (!validator(payload)) {
    throw new ValidationError(errorMessage, { payload });
  }
}

/**
 * Type guard for WhatsApp webhook payload
 */
export function isWhatsAppPayload(payload: unknown): payload is {
  entry: Array<{
    changes: Array<{
      value: {
        messages?: Array<{ from: string; text?: { body: string } }>;
      };
    }>;
  }>;
} {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "entry" in payload &&
    Array.isArray((payload as any).entry)
  );
}

/**
 * Retry an operation with exponential backoff
 * 
 * @param operation - Operation to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelayMs - Base delay in milliseconds
 * @returns Result of the operation
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if not retryable
      if (error instanceof WebhookError && !error.retryable) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));

      logStructuredEvent("OPERATION_RETRY", {
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: lastError.message,
      }, "warn");
    }
  }

  throw new ProcessingError(
    `Operation failed after ${maxRetries} retries: ${lastError!.message}`,
    false
  );
}

/**
 * Export error classes for use in services
 */
export {
  AuthenticationError,
  CircuitBreakerOpenError,
  ExternalServiceError,
  ProcessingError,
  RateLimitError,
  SignatureError,
  TimeoutError,
  ValidationError,
  WebhookError,
};
