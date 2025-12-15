/**
 * Error Handling Utilities
 * 
 * Provides utilities for formatting and sanitizing error messages
 * to prevent exposing internal details to users.
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
 * Sanitize error message to prevent exposing internal details to users
 */
export function sanitizeErrorMessage(error: unknown): string {
  const message = formatUnknownError(error);
  
  // List of patterns that indicate internal/sensitive errors
  const sensitivePatterns = [
    /column|table|relation|schema/i,
    /permission denied/i,
    /authentication failed/i,
    /database|postgres|sql/i,
    /internal server/i,
    /connection|timeout/i,
    /env|environment/i,
  ];
  
  for (const pattern of sensitivePatterns) {
    if (pattern.test(message)) {
      return "An error occurred. Please try again later.";
    }
  }
  
  // Truncate long error messages
  if (message.length > 100) {
    return message.substring(0, 100) + "...";
  }
  
  return message;
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
    errorMessage.includes("already exists") ||
    errorMessage.includes("duplicate") ||
    errorMessage.includes("already registered");
    
  const isSystemError = 
    errorMessage.includes("database") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("ECONNREFUSED");
  
  const statusCode = isUserError ? 400 : (isSystemError ? 503 : 500);
  
  return { isUserError, isSystemError, statusCode };
}

