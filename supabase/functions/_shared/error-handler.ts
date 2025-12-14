/**
 * Error Handler Module for Supabase Edge Functions
 * 
 * Provides structured error handling, recovery mechanisms, and retry queue integration
 * following EasyMO observability ground rules.
 * 
 * @see docs/GROUND_RULES.md for error handling guidelines
 */

import { logStructuredEvent, logError, getCorrelationId } from "./observability.ts";
import { supabase } from "./supabase.ts";

/**
 * Custom error class for workflow operations with recovery support
 */
export class WorkflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public context: Record<string, unknown>,
    public recoverable: boolean = true,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = "WorkflowError";
    
    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorkflowError);
    }
  }
}

/**
 * Custom error class for AI agent operations
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public agentType: string,
    public context: Record<string, unknown>,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = "AgentError";
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentError);
    }
  }
}

/**
 * Custom error class for message processing
 */
export class MessageProcessingError extends Error {
  constructor(
    message: string,
    public messageId: string,
    public context: Record<string, unknown>,
    public shouldRetry: boolean = true
  ) {
    super(message);
    this.name = "MessageProcessingError";
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MessageProcessingError);
    }
  }
}

/**
 * Context for error boundary operations
 */
export interface ErrorBoundaryContext {
  operationName: string;
  userId?: string;
  userPhone?: string;
  correlationId: string;
  messageId?: string;
  agentType?: string;
  workflowType?: string;
}

/**
 * Wraps an async operation with error boundary and automatic retry queue integration
 * 
 * @param operation - The async operation to execute
 * @param context - Context information for logging and recovery
 * @returns Result of the operation
 * 
 * @example
 * ```typescript
 * const result = await withErrorBoundary(
 *   async () => {
 *     const response = await aiAgent.processMessage(message);
 *     return response;
 *   },
 *   {
 *     operationName: "ai_agent_process",
 *     userId: user.id,
 *     correlationId: req.headers.get("x-correlation-id") || crypto.randomUUID(),
 *     messageId: message.id,
 *     agentType: "buy-and-sell-ai"
 *   }
 * );
 * ```
 */
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  context: ErrorBoundaryContext
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await operation();
    
    // Log successful operation
    logStructuredEvent("OPERATION_SUCCESS", {
      ...context,
      duration: Date.now() - startTime,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    const errorDetails = {
      ...context,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : "UnknownError",
      stack: error instanceof Error ? error.stack : undefined,
      duration,
    };
    
    // Log error with appropriate level
    logError(context.operationName, error, errorDetails);
    
    // Handle different error types
    if (error instanceof WorkflowError) {
      if (error.recoverable && error.retryable) {
        await queueForRetry(context, error);
      }
    } else if (error instanceof MessageProcessingError) {
      if (error.shouldRetry && context.messageId) {
        await scheduleMessageRetry(context.messageId, {
          error: error.message,
          context: error.context,
          timestamp: new Date().toISOString(),
        });
      }
    } else if (error instanceof AgentError) {
      if (error.recoverable) {
        // Log agent-specific error for monitoring
        logStructuredEvent("AGENT_ERROR", {
          agentType: error.agentType,
          ...errorDetails,
        }, "error");
      }
    }
    
    // Re-throw the error for upstream handling
    throw error;
  }
}

/**
 * Queue a failed operation for retry in the webhook DLQ
 * 
 * @param context - Error context
 * @param error - The error that occurred
 */
async function queueForRetry(
  context: ErrorBoundaryContext,
  error: WorkflowError
): Promise<void> {
  try {
    const { error: dbError } = await supabase
      .from("webhook_dlq")
      .insert({
        payload: {
          operationName: context.operationName,
          userId: context.userId,
          userPhone: context.userPhone,
          messageId: context.messageId,
          agentType: context.agentType,
          workflowType: context.workflowType,
          errorContext: error.context,
        },
        error: error.message,
        error_stack: error.stack,
        correlation_id: context.correlationId,
        whatsapp_message_id: context.messageId,
        retry_count: 0,
        max_retries: 3,
        next_retry_at: new Date(Date.now() + 1000).toISOString(), // 1 second initial delay
        resolution_status: "pending",
      });
    
    if (dbError) {
      logError("queue_for_retry", dbError, { context, originalError: error.message });
    } else {
      logStructuredEvent("QUEUED_FOR_RETRY", {
        correlationId: context.correlationId,
        operationName: context.operationName,
      });
    }
  } catch (queueError) {
    logError("queue_for_retry_failed", queueError, { context });
  }
}

/**
 * Schedule a message for retry in the message queue
 * 
 * @param messageId - The message ID to retry
 * @param errorDetails - Details about the error
 */
async function scheduleMessageRetry(
  messageId: string,
  errorDetails: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase.rpc("schedule_message_retry", {
      p_message_id: messageId,
      p_error_details: errorDetails,
    });
    
    if (error) {
      logError("schedule_message_retry", error, { messageId, errorDetails });
    } else {
      logStructuredEvent("MESSAGE_RETRY_SCHEDULED", { messageId });
    }
  } catch (retryError) {
    logError("schedule_message_retry_failed", retryError, { messageId });
  }
}

/**
 * Safely execute an operation with timeout
 * 
 * @param operation - The operation to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Name for logging
 * @returns Result of the operation
 * 
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   () => fetch(apiUrl),
 *   5000,
 *   "external_api_call"
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
        () => reject(
          new WorkflowError(
            `Operation ${operationName} timed out after ${timeoutMs}ms`,
            "TIMEOUT",
            { timeoutMs, operationName },
            true,
            true
          )
        ),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Create a safe handler that catches and logs errors
 * 
 * @param handler - The handler function to wrap
 * @param operationName - Name of the operation for logging
 * @returns Wrapped handler that returns error responses on failure
 * 
 * @example
 * ```typescript
 * const safeHandler = createSafeHandler(
 *   async (req) => {
 *     const data = await processRequest(req);
 *     return new Response(JSON.stringify(data), { status: 200 });
 *   },
 *   "webhook_handler"
 * );
 * 
 * serve(safeHandler);
 * ```
 */
export function createSafeHandler(
  handler: (req: Request) => Promise<Response>,
  operationName: string
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const correlationId = getCorrelationId(req);
    
    try {
      return await handler(req);
    } catch (error) {
      logError(operationName, error, {
        correlationId,
        url: req.url,
        method: req.method,
      });
      
      // Return appropriate error response
      const status = error instanceof WorkflowError && !error.recoverable ? 400 : 500;
      const message = error instanceof Error ? error.message : "Internal server error";
      
      return new Response(
        JSON.stringify({
          error: message,
          correlationId,
        }),
        {
          status,
          headers: {
            "Content-Type": "application/json",
            "X-Correlation-ID": correlationId,
          },
        }
      );
    }
  };
}

/**
 * Check if an error is retryable
 * 
 * @param error - The error to check
 * @returns True if the error should be retried
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof WorkflowError) {
    return error.retryable;
  }
  
  if (error instanceof MessageProcessingError) {
    return error.shouldRetry;
  }
  
  if (error instanceof AgentError) {
    return error.recoverable;
  }
  
  // Check for common retryable errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("429") || // Rate limit
      message.includes("503") || // Service unavailable
      message.includes("504")    // Gateway timeout
    );
  }
  
  return false;
}

/**
 * PHASE 3: Error Classification
 * Categorize errors for better observability and alerting
 */
export type ErrorCategory = "user_error" | "system_error" | "external_error" | "unknown";

/**
 * Classify error by category
 */
export function classifyError(error: unknown): ErrorCategory {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  
  // User errors (bad input, validation failures, not found)
  if (
    message.includes("invalid") ||
    message.includes("not found") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("bad request") ||
    message.includes("validation") ||
    message.includes("missing required")
  ) {
    return "user_error";
  }
  
  // External service errors (third-party APIs, timeouts, network)
  if (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("upstream") ||
    message.includes("external") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("429")
  ) {
    return "external_error";
  }
  
  // System errors (database, internal issues, crashes)
  if (
    message.includes("database") ||
    message.includes("internal") ||
    message.includes("server error") ||
    message.includes("crash") ||
    message.includes("panic") ||
    message.includes("500") ||
    message.includes("out of memory") ||
    message.includes("stack overflow")
  ) {
    return "system_error";
  }
  
  return "unknown";
}

/**
 * Format unknown error to string
 */
export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

/**
 * Get stack trace if available
 */
export function getStackTrace(error: unknown): string | null {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return null;
}
