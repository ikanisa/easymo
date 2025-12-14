/**
 * Standard API Response Types
 */

export interface SuccessResponse {
  success: true;
  handled?: boolean;
  ignored?: string;
  data?: unknown;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
  requestId?: string;
  retryAfter?: number;
}

export const ErrorCodes = {
  UNAUTHORIZED: "unauthorized",
  INVALID_PAYLOAD: "invalid_payload",
  SERVICE_UNAVAILABLE: "service_unavailable",
  INTERNAL_ERROR: "internal_error",
} as const;

export function createErrorResponse(
  error: string,
  message?: string,
  options?: {
    requestId?: string;
    retryAfter?: number;
  },
): ErrorResponse {
  return {
    error,
    ...(message && { message }),
    ...(options?.requestId && { requestId: options.requestId }),
    ...(options?.retryAfter && { retryAfter: options.retryAfter }),
  };
}

export function createSuccessResponse(options?: {
  handled?: boolean;
  ignored?: string;
}): SuccessResponse {
  return {
    success: true,
    ...(options?.handled !== undefined && { handled: options.handled }),
    ...(options?.ignored && { ignored: options.ignored }),
  };
}
