/**
 * Centralized error code system for the Ibimina platform
 *
 * Format: DOMAIN_XXX where:
 * - DOMAIN is the subsystem (AUTH, API, DB, PAY, SMS, etc.)
 * - XXX is a sequential number within that domain
 */

export const ERROR_CODES = {
  // Authentication & Authorization (100-199)
  AUTH_UNAUTHORIZED: "AUTH_100",
  AUTH_FORBIDDEN: "AUTH_101",
  AUTH_INVALID_CREDENTIALS: "AUTH_102",
  AUTH_TOKEN_EXPIRED: "AUTH_103",
  AUTH_MFA_REQUIRED: "AUTH_104",
  AUTH_MFA_INVALID: "AUTH_105",
  AUTH_USER_NOT_FOUND: "AUTH_106",
  AUTH_ACCOUNT_LOCKED: "AUTH_107",

  // API & Validation (200-299)
  API_BAD_REQUEST: "API_200",
  API_VALIDATION_FAILED: "API_201",
  API_RATE_LIMIT_EXCEEDED: "API_202",
  API_RESOURCE_NOT_FOUND: "API_203",
  API_METHOD_NOT_ALLOWED: "API_204",
  API_INTERNAL_ERROR: "API_205",

  // Database (300-399)
  DB_CONNECTION_FAILED: "DB_300",
  DB_QUERY_FAILED: "DB_301",
  DB_CONSTRAINT_VIOLATION: "DB_302",
  DB_RECORD_NOT_FOUND: "DB_303",
  DB_DUPLICATE_RECORD: "DB_304",

  // Payments & Wallet (400-499)
  PAY_INSUFFICIENT_FUNDS: "PAY_400",
  PAY_TRANSACTION_FAILED: "PAY_401",
  PAY_INVALID_AMOUNT: "PAY_402",
  PAY_CURRENCY_MISMATCH: "PAY_403",
  PAY_PROVIDER_ERROR: "PAY_404",

  // SMS & Messaging (500-599)
  SMS_SEND_FAILED: "SMS_500",
  SMS_INVALID_NUMBER: "SMS_501",
  SMS_PROVIDER_ERROR: "SMS_502",
  SMS_TEMPLATE_ERROR: "SMS_503",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ErrorInfo {
  code: ErrorCode;
  message: string;
  httpStatus: number;
}

export const getErrorInfo = (code: ErrorCode): ErrorInfo => {
  // Default mapping, can be extended
  switch (code) {
    case ERROR_CODES.AUTH_UNAUTHORIZED:
      return { code, message: "Unauthorized access", httpStatus: 401 };
    case ERROR_CODES.AUTH_FORBIDDEN:
      return { code, message: "Access forbidden", httpStatus: 403 };
    case ERROR_CODES.API_RATE_LIMIT_EXCEEDED:
      return { code, message: "Too many requests", httpStatus: 429 };
    case ERROR_CODES.API_RESOURCE_NOT_FOUND:
      return { code, message: "Resource not found", httpStatus: 404 };
    default:
      return { code, message: "An unexpected error occurred", httpStatus: 500 };
  }
};

export const isValidErrorCode = (code: string): code is ErrorCode => {
  return Object.values(ERROR_CODES).includes(code as ErrorCode);
};
