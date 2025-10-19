import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
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

function toBuffer(value: string): Buffer {
  return Buffer.from(value.normalize());
}

export const runtime = "nodejs";

function constantTimeEquals(a: string, b: string): boolean {
  const left = toBuffer(a);
  const right = toBuffer(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export const POST = createHandler("admin_auth.login", async (request) => {
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
