import type { PostgrestError } from "@supabase/supabase-js";
import { ZodError } from "zod";

export interface ApiErrorOptions {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly requestId?: string;

  constructor({ status, code, message, details, requestId }: ApiErrorOptions) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
      requestId: this.requestId,
    };
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export const fromSupabaseError = (error: PostgrestError, requestId?: string): ApiError =>
  new ApiError({
    status: 502,
    code: "SUPABASE_ERROR",
    message: error.message,
    details: {
      hint: error.hint,
      details: error.details,
      code: error.code,
    },
    requestId,
  });

export const fromZodError = (error: ZodError, requestId: string): ApiError =>
  new ApiError({
    status: 400,
    code: "VALIDATION_ERROR",
    message: "One or more fields failed validation",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
    requestId,
  });

export const normalizeError = (error: unknown, requestId: string): ApiError => {
  if (isApiError(error)) {
    return error.requestId ? error : new ApiError({
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
      requestId,
    });
  }

  if (error instanceof ZodError) {
    return fromZodError(error, requestId);
  }

  return new ApiError({
    status: 500,
    code: "UNEXPECTED_ERROR",
    message: error instanceof Error ? error.message : "Unknown error",
    details: error instanceof Error ? error.stack : error,
    requestId,
  });
};
