import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ProblemDetail = {
  error: string;
  message?: string | Record<string, unknown>;
  details?: unknown;
  integration?: unknown;
  reason?: string;
  blockedAt?: string;
  throttle?: Record<string, unknown>;
};

export function jsonOk<T>(data: T, init?: number | ResponseInit) {
  const status = typeof init === "number" ? init : undefined;
  const responseInit = typeof init === "object" ? init : undefined;
  return NextResponse.json(data as unknown as Record<string, unknown>, {
    status: status ?? 200,
    ...responseInit,
  });
}

export function jsonError(problem: ProblemDetail, status = 400) {
  return NextResponse.json(problem as unknown as Record<string, unknown>, {
    status,
  });
}

export function zodValidationError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError({ error: "invalid_payload", message: error.flatten() }, 400);
  }
  return jsonError({ error: "invalid_payload", message: "Invalid JSON payload." }, 400);
}
