// ═══════════════════════════════════════════════════════════════════════════
// API Response Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ApiResponse<T> {
  data: T;
  error?: never;
}

export interface ApiError {
  error: string;
  details?: unknown;
  data?: never;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface HealthResponse {
  status: "healthy" | "unhealthy";
  database: "connected" | "disconnected";
  timestamp: string;
  version?: string;
  error?: string;
}

export interface ManualMatchRequest {
  sms_id: string;
  member_id: string;
  sacco_id: string;
}

export interface ManualMatchResponse {
  success: boolean;
  data: {
    payment_id: string;
    amount: number;
    member_name: string;
  };
  message: string;
}
