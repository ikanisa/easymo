/**
 * Comprehensive Error Handler for Webhook
 * Provides error categorization, user notifications, and retry logic
 */

import { logStructuredEvent } from "../observe/log.ts";
import { sendWhatsAppMessage } from "../wa/send.ts";

export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  WEBHOOK_VERIFICATION_ERROR = "WEBHOOK_VERIFICATION_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  AGENT_ERROR = "AGENT_ERROR",
  TOOL_EXECUTION_ERROR = "TOOL_EXECUTION_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

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
  request?: any;
}

export class ErrorHandler {
  private errorTemplates: Map<ErrorCode, string>;
  private stats: Map<ErrorCode, number>;

  constructor() {
    this.stats = new Map();
    this.errorTemplates = new Map([
      [
        ErrorCode.VALIDATION_ERROR,
        "❌ Invalid input. Please check your message and try again.",
      ],
      [
        ErrorCode.AUTHENTICATION_ERROR,
        "🔐 Authentication failed. Please verify your account.",
      ],
      [
        ErrorCode.AUTHORIZATION_ERROR,
        "🚫 You don't have permission for this action.",
      ],
      [
        ErrorCode.RATE_LIMIT_ERROR,
        "⏰ Too many requests. Please wait {retryAfter} seconds.",
      ],
      [
        ErrorCode.DATABASE_ERROR,
        "💾 System issue. Our team has been notified.",
      ],
      [
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "🌐 Service temporarily unavailable. Please try again.",
      ],
      [
        ErrorCode.WEBHOOK_VERIFICATION_ERROR,
        "🔒 Security verification failed.",
      ],
      [ErrorCode.TIMEOUT_ERROR, "⏱️ Request timeout. Please try again."],
      [ErrorCode.AGENT_ERROR, "🤖 AI assistant error. Please try again."],
      [
        ErrorCode.TOOL_EXECUTION_ERROR,
        "🔧 Action failed. Please try again later.",
      ],
      [ErrorCode.UNKNOWN_ERROR, "😔 Something went wrong. Please try again later."],
    ]);
  }

  /**
   * Handle error and return appropriate response
   */
  async handle(error: any, context: ErrorContext): Promise<Response> {
    const webhookError = this.normalizeError(error, context);

    // Update stats
    this.stats.set(
      webhookError.code,
      (this.stats.get(webhookError.code) || 0) + 1
    );

    // Log error
    await this.logError(webhookError, context);

    // Send user notification if phone number available
    if (context.phoneNumber) {
      await this.notifyUser(context.phoneNumber, webhookError);
    }

    // Create response
    return this.createResponse(webhookError, context);
  }

  /**
   * Normalize error to WebhookError
   */
  private normalizeError(error: any, context: ErrorContext): WebhookError {
    if (error instanceof WebhookError) {
      error.correlationId = context.correlationId;
      return error;
    }

    // Map known error patterns
    const errorMessage = error.message || error.toString();

    if (errorMessage.includes("rate limit")) {
      return new WebhookError(
        errorMessage,
        ErrorCode.RATE_LIMIT_ERROR,
        429,
        error,
        false
      );
    }

    if (errorMessage.includes("timeout")) {
      return new WebhookError(
        errorMessage,
        ErrorCode.TIMEOUT_ERROR,
        504,
        error,
        true
      );
    }

    if (
      errorMessage.includes("validation") ||
      errorMessage.includes("invalid")
    ) {
      return new WebhookError(
        errorMessage,
        ErrorCode.VALIDATION_ERROR,
        400,
        error,
        false
      );
    }

    if (error.code?.startsWith("P") || errorMessage.includes("database")) {
      return new WebhookError(
        "Database operation failed",
        ErrorCode.DATABASE_ERROR,
        500,
        error,
        true
      );
    }

    if (error.code === "ECONNREFUSED" || errorMessage.includes("fetch")) {
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
   * Log error with structured data
   */
  private async logError(
    error: WebhookError,
    context: ErrorContext
  ): Promise<void> {
    await logStructuredEvent("WEBHOOK_ERROR", {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      retryable: error.retryable,
      ...context,
      stack: error.stack,
    });
  }

  /**
   * Notify user via WhatsApp
   */
  private async notifyUser(
    phoneNumber: string,
    error: WebhookError
  ): Promise<void> {
    try {
      let message =
        this.errorTemplates.get(error.code) ||
        this.errorTemplates.get(ErrorCode.UNKNOWN_ERROR)!;

      // Replace placeholders
      if (error.details?.retryAfter) {
        message = message.replace("{retryAfter}", error.details.retryAfter);
      }

      await sendWhatsAppMessage({
        to: phoneNumber,
        text: `${message}\n\n📋 Ref: ${error.correlationId?.substring(0, 8)}`,
      });
    } catch (notifyError) {
      // Don't throw - this is non-critical
      console.error("User notification failed:", notifyError);
    }
  }

  /**
   * Create HTTP response
   */
  private createResponse(
    error: WebhookError,
    context: ErrorContext
  ): Response {
    const responseBody: any = {
      error: {
        code: error.code,
        message: error.message,
        correlationId: context.correlationId,
      },
    };

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
      headers["Retry-After"] = error.details?.retryAfter || "60";
    }

    return new Response(JSON.stringify(responseBody), {
      status: error.statusCode,
      headers,
    });
  }

  /**
   * Get error statistics
   */
  getStats(): Record<string, number> {
    return Object.fromEntries(this.stats);
  }
}
