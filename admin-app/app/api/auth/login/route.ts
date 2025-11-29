import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { handleAPIError, jsonError, jsonOk } from "@/lib/api/error-handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { clearRateLimit, getRateLimit, recordFailure } from "@/lib/server/rate-limit";
import { createSessionCookie } from "@/lib/server/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

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

export async function POST(request: Request) {
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
      return jsonError("Invalid credentials", 401, "unauthorized");
    }

    // Successful login
    clearRateLimit(key);
    const cookie = createSessionCookie({ actorId: found.actorId, label: found.label ?? found.username });
    try {
      jar.set(cookie.name, cookie.value, { httpOnly: true, sameSite: "lax", path: "/" });
    } catch {
      // ignore
    }

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
