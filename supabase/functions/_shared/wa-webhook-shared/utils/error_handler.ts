/**
 * Enhanced Error Handling for wa-webhook
 * 
 * Provides structured error handling with classification, user notifications,
 * and retry logic. Complements existing error handling.
 * 
 * @see docs/GROUND_RULES.md
 */

import { sendText } from "../wa/client.ts";
import { logStructuredEvent } from "../../observability/index.ts";

// Re-export new error classes from shared for consistency
export { 
  WebhookError as BaseWebhookError,
  ValidationError,
  SignatureError,
  RateLimitError,
  ProcessingError,
  TimeoutError,
  CircuitBreakerOpenError
} from "../../_shared/errors.ts";

export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  WEBHOOK_VERIFICATION_ERROR = "WEBHOOK_VERIFICATION_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

// Keep existing WebhookError for backward compatibility
export class WebhookError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: any;
  correlationId?: string;
  retryable: boolean;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    details?: any,
    retryable: boolean = false
  ) {
    super(message);
    this.name = "WebhookError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.retryable = retryable;
  }
}

interface ErrorContext {
  correlationId: string;
  phoneNumber?: string;
  userId?: string;
  operation?: string;
  duration?: number;
}

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.VALIDATION_ERROR]: "❌ Invalid input. Please check your message and try again.",
  [ErrorCode.AUTHENTICATION_ERROR]: "🔐 Authentication failed. Please verify your account.",
  [ErrorCode.RATE_LIMIT_ERROR]: "⏰ Too many requests. Please wait {retryAfter} seconds.",
  [ErrorCode.DATABASE_ERROR]: "💾 System issue. Our team has been notified.",
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: "🌐 Service temporarily unavailable. Please try again.",
  [ErrorCode.WEBHOOK_VERIFICATION_ERROR]: "🔒 Security verification failed.",
  [ErrorCode.TIMEOUT_ERROR]: "⏱️ Request timeout. Please try again.",
  [ErrorCode.PAYLOAD_TOO_LARGE]: "📦 Message too large. Please send smaller content.",
  [ErrorCode.UNKNOWN_ERROR]: "😔 Something went wrong. Please try again later.",
};

/**
 * Normalize any error to WebhookError
 */
export function normalizeError(error: any, context: ErrorContext): WebhookError {
  if (error instanceof WebhookError) {
    error.correlationId = context.correlationId;
    return error;
  }

  const errorMessage = error?.message || String(error);

  // Map known error patterns
  if (errorMessage.includes("rate limit") || errorMessage.includes("too many")) {
    return new WebhookError(
      errorMessage,
      ErrorCode.RATE_LIMIT_ERROR,
      429,
      error,
      false
    );
  }

  if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
    return new WebhookError(
      errorMessage,
      ErrorCode.TIMEOUT_ERROR,
      504,
      error,
      true
    );
  }

  if (errorMessage.includes("validation") || errorMessage.includes("invalid")) {
    return new WebhookError(
      errorMessage,
      ErrorCode.VALIDATION_ERROR,
      400,
      error,
      false
    );
  }

  if (errorMessage.includes("payload") && errorMessage.includes("large")) {
    return new WebhookError(
      errorMessage,
      ErrorCode.PAYLOAD_TOO_LARGE,
      413,
      error,
      false
    );
  }

  // Database errors (Postgres error codes start with 'P')
  if (error?.code?.startsWith("P") || errorMessage.includes("database")) {
    return new WebhookError(
      "Database operation failed",
      ErrorCode.DATABASE_ERROR,
      500,
      error,
      true
    );
  }

  // Network errors
  if (error?.code === "ECONNREFUSED" || errorMessage.includes("fetch failed")) {
    return new WebhookError(
      "External service unavailable",
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      503,
      error,
      true
    );
  }

  // Default to unknown error
  return new WebhookError(
    errorMessage,
    ErrorCode.UNKNOWN_ERROR,
    500,
    error,
    false
  );
}

/**
 * Handle webhook error with logging and optional user notification
 */
export async function handleWebhookError(
  error: any,
  context: ErrorContext,
  notifyUser: boolean = false
): Promise<Response> {
  const webhookError = normalizeError(error, context);

  // Log error with structured event
  await logStructuredEvent("WEBHOOK_ERROR", {
    code: webhookError.code,
    message: webhookError.message,
    statusCode: webhookError.statusCode,
    retryable: webhookError.retryable,
    correlationId: context.correlationId,
    phoneNumber: context.phoneNumber ? maskPhone(context.phoneNumber) : undefined,
    userId: context.userId,
    operation: context.operation,
    duration: context.duration,
  });

  // Send user notification if requested and phone number available
  if (notifyUser && context.phoneNumber) {
    await notifyUserOfError(context.phoneNumber, webhookError);
  }

  // Create response
  return createErrorResponse(webhookError, context);
}

/**
 * Send error notification to user
 */
async function notifyUserOfError(
  phoneNumber: string,
  error: WebhookError
): Promise<void> {
  try {
    let message = ERROR_MESSAGES[error.code] || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];

    // Replace placeholders
    if (error.details?.retryAfter) {
      message = message.replace("{retryAfter}", String(error.details.retryAfter));
    }

    // Add correlation ID for support
    const ref = error.correlationId?.substring(0, 8) || "unknown";
    message += `\n\n📋 Ref: ${ref}`;

    await sendText(phoneNumber, message);
  } catch (notifyError) {
    console.error(JSON.stringify({
      event: "USER_NOTIFICATION_FAILED",
      error: String(notifyError),
      originalError: error.code,
    }));
  }
}

/**
 * Create error response
 */
function createErrorResponse(
  error: WebhookError,
  context: ErrorContext
): Response {
  const isDevelopment = Deno.env.get("APP_ENV") === "development" ||
                        Deno.env.get("NODE_ENV") === "development";

  const responseBody: any = {
    error: {
      code: error.code,
      message: error.message,
      correlationId: context.correlationId,
    },
  };

  // Add debug info in development
  if (isDevelopment) {
    responseBody.error.details = error.details;
    responseBody.error.stack = error.stack;
  }

  // Add processing time if available
  if (context.duration) {
    responseBody.processingTime = `${context.duration}ms`;
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Correlation-ID": context.correlationId,
  };

  // Add retry headers for retryable errors
  if (error.retryable) {
    headers["Retry-After"] = String(error.details?.retryAfter || 60);
  }

  return new Response(
    JSON.stringify(responseBody),
    {
      status: error.statusCode,
      headers,
    }
  );
}

/**
 * Mask phone number for logging (PII protection)
 */
function maskPhone(phone: string): string {
  if (phone.length <= 7) return "***";
  return phone.slice(0, 4) + "***" + phone.slice(-3);
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof WebhookError) {
    return error.retryable;
  }

  const message = String(error?.message || error);
  return message.includes("timeout") ||
         message.includes("database") ||
         message.includes("connection") ||
         message.includes("503") ||
         message.includes("504");
}

/**
 * Get retry delay based on attempt number
 */
export function getRetryDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}
