import { ERROR_CODES, type ErrorCode, getErrorInfo, isValidErrorCode } from "./codes";

export { ERROR_CODES, type ErrorCode, getErrorInfo, isValidErrorCode };

/**
 * Application-specific error class with structured error codes
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    const info = getErrorInfo(code);
    super(message || info.message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = info.httpStatus;
    this.details = details;
  }

  public toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}
