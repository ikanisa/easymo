/**
 * Centralized error handling utilities
 * 
 * This module provides:
 * - Custom error classes for better error categorization
 * - Error sanitization to prevent information disclosure
 * - Type-safe error handling
 */

/**
 * Custom application error class
 * 
 * Extends the standard Error class with additional fields for
 * error codes, HTTP status codes, and structured metadata.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Sanitized error response structure
 * Safe to send to clients without exposing internal details
 */
export interface SanitizedError {
  message: string;
  code: string;
}

/**
 * Sanitize error for client response
 * 
 * Converts errors to a safe format that doesn't expose internal implementation
 * details or sensitive information. Full error details are logged server-side.
 * 
 * @param error - The error to sanitize
 * @returns Safe error object with message and code
 */
export function sanitizeError(error: unknown): SanitizedError {
  // Handle our custom AppError instances
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
    };
  }
  
  // Handle standard Error instances
  if (error instanceof Error) {
    // Log full error for debugging (server-side only)
    console.error('[ERROR]', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    
    // Check for known error patterns
    const errorMessage = error.message.toLowerCase();
    
    // Rate limit errors
    if (errorMessage.includes('rate_limit') || errorMessage.includes('rate limit')) {
      return {
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      };
    }
    
    // Authentication errors
    if (errorMessage.includes('unauthorized') || errorMessage.includes('auth')) {
      return {
        message: 'Authentication failed. Please sign in again.',
        code: 'UNAUTHORIZED',
      };
    }
    
    // Permission errors
    if (errorMessage.includes('forbidden') || errorMessage.includes('permission')) {
      return {
        message: 'You do not have permission to perform this action.',
        code: 'FORBIDDEN',
      };
    }
    
    // Not found errors
    if (errorMessage.includes('not found')) {
      return {
        message: 'The requested resource was not found.',
        code: 'NOT_FOUND',
      };
    }
    
    // Validation errors
    if (errorMessage.includes('invalid') || errorMessage.includes('validation')) {
      return {
        message: 'Invalid input. Please check your data and try again.',
        code: 'VALIDATION_ERROR',
      };
    }
  }
  
  // Log unexpected error types
  console.error('[ERROR] Unexpected error type:', error);
  
  // Return generic message for unknown errors
  return {
    message: 'An unexpected error occurred. Please try again later.',
    code: 'INTERNAL_ERROR',
  };
}

/**
 * Common error factory functions
 * Provides consistent error creation across the application
 */
export const Errors = {
  validation: (message: string, details?: unknown) =>
    new AppError(message, 'VALIDATION_ERROR', 400, details),
  
  unauthorized: (message = 'Authentication required') =>
    new AppError(message, 'UNAUTHORIZED', 401),
  
  forbidden: (message = 'Permission denied') =>
    new AppError(message, 'FORBIDDEN', 403),
  
  notFound: (message = 'Resource not found') =>
    new AppError(message, 'NOT_FOUND', 404),
  
  rateLimit: (message = 'Too many requests') =>
    new AppError(message, 'RATE_LIMIT_EXCEEDED', 429),
  
  internal: (message = 'Internal server error', details?: unknown) =>
    new AppError(message, 'INTERNAL_ERROR', 500, details),
  
  conflict: (message: string) =>
    new AppError(message, 'CONFLICT', 409),
  
  badRequest: (message: string, details?: unknown) =>
    new AppError(message, 'BAD_REQUEST', 400, details),
} as const;
