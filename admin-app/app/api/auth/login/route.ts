import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearRateLimit, getRateLimit, recordFailure } from "@/lib/server/rate-limit";
import { createSessionCookie } from "@/lib/server/session";

type Credentials = { actorId: string; email: string; password: string; username?: string; label?: string };

function readCredentials(): Credentials[] {
  try {
    const raw = process.env.ADMIN_ACCESS_CREDENTIALS;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Credentials[];
    return [];
  } catch {
    return [];
  }
}

function validatePayload(body: unknown): body is { email: string; password: string } {
  if (!body || typeof body !== "object") return false;
  const { email, password } = body as { email?: unknown; password?: unknown };
  const emailOk = typeof email === "string" && /.+@.+\..+/.test(email);
  const pwOk = typeof password === "string" && password.length >= 4;
  return emailOk && pwOk;
}

export async function POST(request: Request) {
  const jar = await cookies();
  const payload = await request.json().catch(() => null);

  if (!validatePayload(payload)) {
    return NextResponse.json(
      { error: "validation_error", message: "Invalid email or password format." },
      { status: 400 },
    );
  }

  const { email, password } = payload;
  const key = `login:${email}`;

  // Check if using admin token
  const adminToken = process.env.EASYMO_ADMIN_TOKEN;
  if (adminToken && password === adminToken) {
    // Token-based authentication
    clearRateLimit(key);
    const cookie = createSessionCookie({ 
      actorId: "admin-token", 
      label: email.split("@")[0] || "Admin" 
    });
    try {
      jar.set(cookie.name, cookie.value, { httpOnly: true, sameSite: "lax", path: "/" });
    } catch {
      // ignore
    }

    const res = NextResponse.json(
      { actorId: "admin-token", label: email.split("@")[0] || "Admin" },
      { status: 200 },
    );
    res.headers.set("x-admin-session-refreshed", "true");
    return res;
  }

  // Credentials-based authentication
  const creds = readCredentials();
  const found = creds.find((c) => c.email.toLowerCase() === email.toLowerCase());

  if (!found || found.password !== password) {
    // Enforce: allow MAX_ATTEMPTS failures (401), then block with 429 on subsequent attempts.
    const before = getRateLimit(key);
    if (before.remaining <= 0) {
      const { resetIn, remaining } = before;
      const res = new NextResponse("Too Many Attempts", { status: 429 });
      res.headers.set("Retry-After", String(resetIn));
      res.headers.set("X-RateLimit-Remaining", String(remaining));
      return res;
    }
    recordFailure(key);
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Successful login
  clearRateLimit(key);
  const cookie = createSessionCookie({ actorId: found.actorId, label: found.label ?? found.username });
  try {
    jar.set(cookie.name, cookie.value, { httpOnly: true, sameSite: "lax", path: "/" });
  } catch {
    // ignore
  }

  const res = NextResponse.json(
    { actorId: found.actorId, label: found.label ?? found.username ?? "Admin" },
    { status: 200 },
  );
  res.headers.set("x-admin-session-refreshed", "true");
  return res;
}
