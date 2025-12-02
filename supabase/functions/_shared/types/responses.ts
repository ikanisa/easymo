/**
 * Response Types
 * API response type definitions
 */

// ============================================================================
// API RESPONSES
// ============================================================================

/**
 * Success response
 */
export type SuccessResponse<T = unknown> = {
  success: true;
  data?: T;
  message?: string;
};

/**
 * Error response
 */
export type ErrorResponse = {
  success: false;
  error: string;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;
  retryable?: boolean;
  retryAfter?: number;
};

/**
 * API response union
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Health check response
 */
export type HealthCheckResponse = {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  version: string;
  timestamp: string;
  uptime?: number;
  checks: {
    database: "connected" | "disconnected" | "error";
    latency?: string;
  };
  dependencies?: Record<string, boolean>;
  errors?: string[];
};

// ============================================================================
// WEBHOOK RESPONSES
// ============================================================================

/**
 * Webhook processing response
 */
export type WebhookResponse = {
  success: boolean;
  handled?: boolean;
  ignored?: string;
  error?: string;
  requestId?: string;
};

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Paginated response
 */
export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

// ============================================================================
// OPERATION RESULTS
// ============================================================================

/**
 * Generic operation result
 */
export type OperationResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
};

/**
 * Transfer result
 */
export type TransferResult = OperationResult<{
  transactionId: string;
  newBalance: number;
}>;

/**
 * Trip result
 */
export type TripResult = OperationResult<{
  tripId: string;
  status: string;
}>;

/**
 * Claim result
 */
export type ClaimResult = OperationResult<{
  claimId: string;
  reference: string;
  status: string;
}>;
