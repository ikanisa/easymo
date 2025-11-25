import { NextFunction,Request, Response } from "express";
import { ZodError } from "zod";

import { logger } from "./logger";

/**
 * Standardized error response structure
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Application-specific error class
 */
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
} as const;

/**
 * Format Zod validation errors into a user-friendly format
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "root";
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }
  return formatted;
}

/**
 * Centralized error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestId = (req as any).id as string | undefined;

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      code: ErrorCodes.VALIDATION_ERROR,
      message: "Validation failed",
      details: { fields: formatZodErrors(err) },
      requestId,
    };
    logger.warn({ msg: "validation.error", requestId, errors: response.details });
    res.status(400).json(response);
    return;
  }

  // Handle application errors
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      code: err.code,
      message: err.message,
      details: err.details,
      requestId,
    };
    logger.warn({ msg: "app.error", code: err.code, requestId, details: err.details });
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unexpected errors
  logger.error({ msg: "unhandled.error", error: err.message, stack: err.stack, requestId });
  
  const response: ErrorResponse = {
    code: ErrorCodes.INTERNAL_ERROR,
    message: "An unexpected error occurred",
    requestId,
  };
  res.status(500).json(response);
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestId = (req as any).id as string | undefined;
  const response: ErrorResponse = {
    code: ErrorCodes.NOT_FOUND,
    message: `Route ${req.method} ${req.path} not found`,
    requestId,
  };
  res.status(404).json(response);
}
