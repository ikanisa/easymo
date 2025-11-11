/**
 * Centralized Fallback System for All AI Agents
 * 
 * Provides:
 * - Standardized fallback data structures
 * - Fallback scoring and ranking algorithms
 * - Error classification and recovery
 * - User-friendly messaging
 */

export type FallbackStatus = "ok" | "degraded" | "failed";

export interface FallbackIntegration {
  status: FallbackStatus;
  target: string;
  message?: string;
  remediation?: string;
  timestamp?: string;
}

export interface FallbackResponse<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  integration: FallbackIntegration;
}

/**
 * Score items based on common quality signals
 */
export function scoreItem(item: {
  rating?: number | null;
  verified?: boolean;
  totalReviews?: number;
  updatedAt?: string | null;
}): number {
  const ratingComponent = ((item.rating ?? 3) / 5) * 0.6;
  const verifiedBonus = item.verified ? 0.2 : 0;
  const reviewComponent = Math.min(item.totalReviews ?? 0, 200) / 200 * 0.15;
  
  const freshnessComponent =
    item.updatedAt && Number.isFinite(Date.parse(item.updatedAt))
      ? Math.max(0, 1 - (Date.now() - Date.parse(item.updatedAt)) / (1000 * 60 * 60 * 24 * 30)) * 0.05
      : 0;
  
  return ratingComponent + verifiedBonus + reviewComponent + freshnessComponent;
}

/**
 * Filter items by search term
 */
export function filterBySearch<T extends Record<string, any>>(
  items: T[],
  search: string | undefined,
  fields: (keyof T)[]
): T[] {
  if (!search) return items;
  
  const lower = search.toLowerCase();
  return items.filter((item) =>
    fields.some((field) => {
      const value = item[field];
      if (typeof value === "string") {
        return value.toLowerCase().includes(lower);
      }
      if (Array.isArray(value)) {
        return value.some((v) =>
          typeof v === "string" ? v.toLowerCase().includes(lower) : false
        );
      }
      return false;
    })
  );
}

/**
 * Create a standardized fallback response
 */
export function createFallbackResponse<T>(
  data: T[],
  target: string,
  message: string,
  remediation: string
): FallbackResponse<T> {
  return {
    data,
    total: data.length,
    hasMore: false,
    integration: {
      status: "degraded",
      target,
      message,
      remediation,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Error classification for better handling
 */
export enum FallbackErrorType {
  SUPABASE_UNAVAILABLE = "supabase_unavailable",
  QUERY_FAILED = "query_failed",
  NETWORK_ERROR = "network_error",
  AUTH_ERROR = "auth_error",
  TIMEOUT = "timeout",
  VALIDATION_ERROR = "validation_error",
  UNKNOWN = "unknown",
}

export function classifyError(error: any): FallbackErrorType {
  const message = error?.message?.toLowerCase() || "";
  
  if (message.includes("timeout")) return FallbackErrorType.TIMEOUT;
  if (message.includes("auth") || message.includes("unauthorized")) return FallbackErrorType.AUTH_ERROR;
  if (message.includes("network") || message.includes("fetch")) return FallbackErrorType.NETWORK_ERROR;
  if (message.includes("validation")) return FallbackErrorType.VALIDATION_ERROR;
  if (error?.code === "PGRST") return FallbackErrorType.QUERY_FAILED;
  
  return FallbackErrorType.UNKNOWN;
}

/**
 * Get user-friendly error message
 */
export function getUserMessage(errorType: FallbackErrorType): string {
  switch (errorType) {
    case FallbackErrorType.SUPABASE_UNAVAILABLE:
      return "Database service temporarily unavailable. Showing cached results.";
    case FallbackErrorType.QUERY_FAILED:
      return "Query failed. Showing default results.";
    case FallbackErrorType.NETWORK_ERROR:
      return "Network connection issue. Showing cached data.";
    case FallbackErrorType.AUTH_ERROR:
      return "Authentication error. Please check credentials.";
    case FallbackErrorType.TIMEOUT:
      return "Request timed out. Showing fallback data.";
    case FallbackErrorType.VALIDATION_ERROR:
      return "Invalid request. Showing default results.";
    default:
      return "Service temporarily unavailable. Showing fallback data.";
  }
}

/**
 * Pagination helper for fallback data
 */
export function paginateFallback<T>(
  items: T[],
  limit?: number,
  offset?: number
): { data: T[]; total: number; hasMore: boolean } {
  const start = offset ?? 0;
  const end = start + (limit ?? 50);
  const data = items.slice(start, end);
  
  return {
    data,
    total: items.length,
    hasMore: end < items.length,
  };
}

/**
 * Rank items with scoring and sorting
 */
export function rankItems<T extends { score?: number }>(
  items: T[],
  scoreFunction: (item: T) => number,
  topN?: number
): T[] {
  const scored = items.map((item) => ({
    ...item,
    score: scoreFunction(item),
  }));
  
  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  
  return topN ? scored.slice(0, topN) : scored;
}
