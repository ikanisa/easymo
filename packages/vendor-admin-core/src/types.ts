/**
 * Common types for vendor admin core
 */

/**
 * Result of an operation
 */
export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: string[];
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Sort order
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Sort parameters
 */
export interface SortParams<T extends string = string> {
  field: T;
  order: SortOrder;
}

/**
 * Filter parameters
 */
export interface FilterParams {
  search?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Currency code (ISO 4217)
 */
export type CurrencyCode = 'RWF' | 'USD' | 'EUR' | 'KES' | 'UGX' | 'TZS';

/**
 * Money representation
 */
export interface Money {
  amount: number;
  currency: CurrencyCode;
}

/**
 * Format money for display
 */
export function formatMoney(money: Money, locale = 'rw-RW'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(money.amount);
}

/**
 * Admin action audit entry
 */
export interface AdminActionAudit {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  timestamp: Date;
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
}
