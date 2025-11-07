export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { createHandler } from "@/app/api/withObservability";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session-token";

// Simple admin credentials from environment
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "info@ikanisa.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_ACTOR_ID = process.env.ADMIN_ACTOR_ID || "00000000-0000-0000-0000-000000000001";

// Simple rate limiting
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60000; // 1 minute

function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(ip: string): boolean {
  const bucket = loginAttempts.get(ip);
  if (!bucket || bucket.resetAt <= Date.now()) {
    loginAttempts.delete(ip);
    return false;
  }
  return bucket.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip: string) {
  const bucket = loginAttempts.get(ip);
  const now = Date.now();
  if (!bucket || bucket.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    bucket.count += 1;
  }
}

export const POST = createHandler("admin_auth.login", async (request) => {
  // Check if admin credentials are configured
  if (!ADMIN_PASSWORD) {
    console.error("[admin-login] ADMIN_PASSWORD not configured");
    return NextResponse.json(
      { error: "auth_unconfigured", message: "Admin authentication not configured" },
      { status: 503 },
    );
  }

  // Rate limiting
  const clientIP = getClientIP(request);
  if (isRateLimited(clientIP)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many login attempts. Try again later." },
      { status: 429 },
    );
  }

  // Parse request body
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Invalid request body" },
      { status: 400 },
    );
  }

  const { email, password } = body;

  // Validate input
  if (!email || !password) {
    recordAttempt(clientIP);
    return NextResponse.json(
      { error: "invalid_input", message: "Email and password required" },
      { status: 400 },
    );
  }

  // Simple authentication check
  if (email.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
    recordAttempt(clientIP);
    console.warn("[admin-login] Failed login attempt", { email, ip: clientIP });
    return NextResponse.json(
      { error: "invalid_credentials", message: "Invalid email or password" },
      { status: 401 },
    );
  }

  // Clear rate limit on success
  loginAttempts.delete(clientIP);

  // Create session token
  const { token, expiresAt } = await createSessionToken(ADMIN_ACTOR_ID);
  const sessionTTL = 12 * 60 * 60; // 12 hours

  const response = NextResponse.json({
    ok: true,
    actorId: ADMIN_ACTOR_ID,
    expiresAt,
  });

  // Set session cookie
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: sessionTTL,
  });

  console.log("[admin-login] Successful login", { email, actorId: ADMIN_ACTOR_ID });

  return response;
});

export const runtime = "nodejs";

