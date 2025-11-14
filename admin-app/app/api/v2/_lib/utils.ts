import { NextResponse } from "next/server";
import { ZodError } from "zod";

interface SupabaseErrorLike {
  code?: string;
  message?: string;
}

export function handleRouteError(error: unknown, fallbackStatus = 500) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "invalid_payload",
        details: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  if (error && typeof error === "object" && "code" in error) {
    const { code, message } = error as SupabaseErrorLike;
    if (code === "PGRST116") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: "supabase_error",
        code,
        message: message ?? "Supabase request failed",
      },
      { status: fallbackStatus },
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: "internal_error",
        message: error.message,
      },
      { status: fallbackStatus },
    );
  }

  return NextResponse.json({ error: "internal_error" }, { status: fallbackStatus });
}

export function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function coerceNullableString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}
