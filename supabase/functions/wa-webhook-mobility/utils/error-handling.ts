/**
 * Error Handling Utilities
 * 
 * Provides utilities for formatting and classifying error messages
 * to determine appropriate HTTP status codes.
 */

/**
 * Format unknown error types into a string message
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
 * Classify error type for appropriate HTTP status code
 */
export function classifyError(error: unknown): {
  isUserError: boolean;
  isSystemError: boolean;
  statusCode: number;
} {
  const errorMessage = formatUnknownError(error);
  
  const isUserError = 
    errorMessage.includes("validation") || 
    errorMessage.includes("invalid") ||
    errorMessage.includes("not found") ||
    errorMessage.includes("already exists");
    
  const isSystemError = 
    errorMessage.includes("database") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("ECONNREFUSED");
  
  const statusCode = isUserError ? 400 : (isSystemError ? 503 : 500);
  
  return { isUserError, isSystemError, statusCode };
}

