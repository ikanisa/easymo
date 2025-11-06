export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { logStructured } from "@/lib/server/logger";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session-token";
import {
  findCredentialByToken,
  getAdminAccessCredentials,
} from "@/lib/auth/credentials";

const requestSchema = z.object({
  token: z.string().min(8, "token_required"),
});

const MAX_ATTEMPTS = Number.parseInt(process.env.ADMIN_LOGIN_MAX_ATTEMPTS ?? "5", 10);
const WINDOW_MS = Number.parseInt(process.env.ADMIN_LOGIN_WINDOW_MS ?? "60000", 10);
const loginBuckets = new Map<string, { count: number; resetAt: number }>();

const now = () => Date.now();
const textEncoder = new TextEncoder();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || "unknown";
}

function isRateLimited(key: string): boolean {
  const bucket = loginBuckets.get(key);
  if (!bucket) return false;
  if (bucket.resetAt <= now()) {
    loginBuckets.delete(key);
    return false;
  }
  return bucket.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(key: string) {
  const bucket = loginBuckets.get(key);
  if (!bucket || bucket.resetAt <= now()) {
    loginBuckets.set(key, { count: 1, resetAt: now() + WINDOW_MS });
    return;
  }
  bucket.count += 1;
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = textEncoder.encode(a.normalize());
  const right = textEncoder.encode(b.normalize());
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

export const POST = createHandler("admin_auth.login", async (request) => {
  const key = clientKey(request);
  if (isRateLimited(key)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many login attempts. Try again later." },
      { status: 429 },
    );
  }

  const credentials = getAdminAccessCredentials();
  if (!credentials.length) {
    return NextResponse.json(
      {
        error: "auth_unconfigured",
        message:
          "Admin access credentials are not configured. Set ADMIN_ACCESS_CREDENTIALS.",
      },
      { status: 503 },
    );
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid_payload",
        message: error instanceof z.ZodError ? error.flatten() : "Invalid payload.",
      },
      { status: 400 },
    );
  }

  const match = findCredentialByToken(body.token)
    ?? credentials.find((candidate) => constantTimeEquals(candidate.token, body.token));

  if (!match) {
    recordFailedAttempt(key);
    logStructured({
      event: "admin_auth.login_denied",
      status: "error",
      details: { reason: "invalid_token" },
    });
    return NextResponse.json(
      {
        error: "invalid_token",
        message: "Access token not recognized.",
      },
      { status: 401 },
    );
  }

  loginBuckets.delete(key);

  const { token, expiresAt } = await createSessionToken(match.actorId);
  const ttlRaw = process.env.ADMIN_SESSION_TTL_SECONDS;
  const ttlSeconds = Number.parseInt(ttlRaw ?? "", 10);
  const maxAge = Number.isNaN(ttlSeconds) || ttlSeconds <= 0 ? 60 * 60 * 12 : ttlSeconds;

  const response = NextResponse.json(
    {
      ok: true,
      actorId: match.actorId,
      label: match.label ?? null,
      expiresAt,
    },
    { status: 200 },
  );

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
    priority: "high",
  });

  response.cookies.set("admin_actor_id", "", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  logStructured({
    event: "admin_auth.login_success",
    status: "ok",
    details: { actorId: match.actorId },
  });

  return response;
});

export const runtime = "edge";
