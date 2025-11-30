import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { handleAPIError, jsonError, jsonOk } from "@/lib/api/error-handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { logStructured } from "@/lib/server/logger";
import { clearRateLimit, getRateLimit, recordFailure } from "@/lib/server/rate-limit";
import { 
  clearCsrfCookie,
  clearSessionCookie, 
  createCsrfCookie,
  createSessionCookie,
  generateCsrfToken,
} from "@/lib/server/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type Credentials = { actorId: string; email: string; passwordHash: string; username?: string; label?: string };

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

export async function POST(request: Request) {
  // Build correlationId for logging
  const correlationId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  
  try {
    // 1. Global Rate Limit (IP-based) - protect against DDoS
    const globalLimiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 500 });
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    await globalLimiter.check(10, ip); // Strict limit for login endpoint (10 req/min)

    const jar = await cookies();
    const body = await request.json().catch(() => ({}));
    
    // 2. Input Validation
    const payload = loginSchema.parse(body);
    const { email, password } = payload;
    
    // 3. Login Logic Rate Limit (Email-based) - protect against brute force
    const key = `login:${email}`;

    // Credentials-based authentication
    const creds = readCredentials();
    const found = creds.find((c) => c.email.toLowerCase() === email.toLowerCase());

    // Verify password using bcrypt hash comparison
    let passwordValid = false;
    if (found?.passwordHash) {
      passwordValid = await bcrypt.compare(password, found.passwordHash);
    }

    if (!found || !passwordValid) {
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
      return jsonError("Invalid credentials", 401, "unauthorized");
    }

    // Successful login - clear rate limit
    clearRateLimit(key);

    // Session rotation: clear any existing session and CSRF cookies before creating new ones
    const clearSessionCookieObj = clearSessionCookie();
    const clearCsrfCookieObj = clearCsrfCookie();
    try {
      jar.set(clearSessionCookieObj.name, clearSessionCookieObj.value, clearSessionCookieObj.attributes);
      jar.set(clearCsrfCookieObj.name, clearCsrfCookieObj.value, clearCsrfCookieObj.attributes);
    } catch {
      // ignore - may fail if cookies are already sent
    }

    // Create new session cookie
    const sessionCookie = createSessionCookie({ actorId: found.actorId, label: found.label ?? found.username });
    
    // Create new CSRF token and cookie for double-submit pattern
    const csrfToken = generateCsrfToken();
    const csrfCookie = createCsrfCookie(csrfToken);
    
    try {
      jar.set(sessionCookie.name, sessionCookie.value, { httpOnly: true, sameSite: "lax", path: "/" });
      jar.set(csrfCookie.name, csrfCookie.value, csrfCookie.attributes);
    } catch {
      // ignore
    }

    // Log successful login per GROUND_RULES.md observability requirements
    logStructured({
      event: "USER_LOGIN",
      target: "admin-auth",
      actor: found.actorId,
      status: "ok",
      message: "Admin user logged in successfully",
      details: {
        userId: found.actorId,
        email: email.toLowerCase(),
        method: "credentials",
        correlationId,
      },
    });

    const res = jsonOk({ actorId: found.actorId, label: found.label ?? found.username ?? "Admin" });
    res.headers.set("x-admin-session-refreshed", "true");
    return res;

  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Validation failed", 400, "validation_error");
    }
    return handleAPIError(error);
  }
}
