/**
 * Logging utilities with correlation ID support
 * 
 * Ensures all logs include correlation ID for distributed tracing.
 * Part of CORE-002 fix for consistent correlation ID propagation.
 */

import { logStructuredEvent } from "./observability.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  correlationId: string;
  requestId?: string;
  service?: string;
  [key: string]: unknown;
}

/**
 * Create a logging function with correlation context
 * 
 * @example
 * const log = withCorrelation({ correlationId: "abc-123", service: "wa-webhook-core" });
 * log("USER_ACTION", { userId: "123" }); // Automatically includes correlationId
 */
export function withCorrelation(context: LogContext) {
  return (
    event: string,
    details: Record<string, unknown> = {},
    level: LogLevel = "info"
  ): void => {
    logStructuredEvent(
      event,
      {
        ...context,
        ...details,
      },
      level
    );
  };
}

/**
 * Enhanced console.error with correlation ID
 * Use this instead of raw console.error
 */
export function logError(
  message: string,
  error: unknown,
  context: LogContext
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(JSON.stringify({
    event: "ERROR",
    message,
    error: errorMessage,
    stack: errorStack,
    ...context,
  }));
}

/**
 * Enhanced console.warn with correlation ID
 * Use this instead of raw console.warn
 */
export function logWarn(
  message: string,
  details: Record<string, unknown>,
  context: LogContext
): void {
  console.warn(JSON.stringify({
    event: "WARNING",
    message,
    ...details,
    ...context,
  }));
}

/**
 * Enhanced console.log with correlation ID
 * Use this instead of raw console.log for structured events
 */
export function logInfo(
  event: string,
  details: Record<string, unknown>,
  context: LogContext
): void {
  console.log(JSON.stringify({
    event,
    ...details,
    ...context,
  }));
}
